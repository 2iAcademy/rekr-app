"""US #215: explicit batch, separate real/synthetic cohorts; no ranking mutation."""
import argparse
from datetime import datetime, timezone
from uuid import uuid4
from pyspark.sql import SparkSession, functions as F, Window
from pyspark.sql.types import (StructType, StructField, StringType, LongType)
from pyspark.ml import Pipeline
from pyspark.ml.feature import StringIndexer, OneHotEncoder, VectorAssembler
from pyspark.ml.classification import LogisticRegression
from pyspark.ml.evaluation import BinaryClassificationEvaluator

parser = argparse.ArgumentParser()
parser.add_argument("--source", choices=["real", "synthetic"], required=True)
parser.add_argument("--input", default="hdfs://namenode:9000/lake/raw/events/*/*.json")
parser.add_argument("--output", default="hdfs://namenode:9000/lake/curated")
args = parser.parse_args()
spark = SparkSession.builder.appName("rekr-swipes-" + args.source).getOrCreate()
spark.sparkContext.setLogLevel("WARN")
spark.conf.set("spark.sql.session.timeZone", "UTC")
spark.conf.set("spark.sql.shuffle.partitions", "2")
schema = StructType([StructField(n, t, True) for n, t in [
    ("schema_version", LongType()), ("event_id", StringType()),
    ("source", StringType()), ("type", StringType()), ("occurred_at", StringType()),
    ("candidate_id", LongType()), ("offer_id", LongType()),
    ("job_family_id", LongType()), ("position", LongType())]])
events = (spark.read.schema(schema).json(args.input)
          .filter((F.col("source") == args.source) & (F.col("schema_version") == 1))
          .dropDuplicates(["event_id"]).withColumn("time", F.to_timestamp("occurred_at")).cache())
if not events.take(1):
    raise SystemExit("No events for selected source; generate/collect events and wait for sink first.")
run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid4().hex[:8]
root = args.output.rstrip("/") + "/source=" + args.source + "/run=" + run_id

def save(name, frame):
    print("\n" + args.source.upper() + " / " + name)
    frame.show(30, truncate=False)
    frame.write.mode("overwrite").parquet(root + "/" + name)

# Denominator is completed decisions, not all impressions or all candidates.
decisions = (events.filter(F.col("type").isin("like", "pass"))
             .withColumn("label", (F.col("type") == "like").cast("double")))
save("like_rate_by_family", decisions.groupBy("job_family_id").agg(
    F.count("*").alias("decisions"), F.sum("label").alias("likes"),
    F.avg("label").alias("like_rate")))
# Attribute to the most recent PRECEDING card impression for the same pair.
# A browser signal is not proof of attention; missing signals stay unknown.
d = decisions.drop("position").alias("d")
f = events.filter(F.col("type") == "impression").alias("f")
joined = d.join(f, (F.col("d.candidate_id") == F.col("f.candidate_id")) &
                   (F.col("d.offer_id") == F.col("f.offer_id")) &
                   (F.col("f.time") <= F.col("d.time")), "left")
ranked = joined.withColumn("rn", F.row_number().over(
    Window.partitionBy("d.event_id").orderBy(F.col("f.time").desc(), F.col("f.event_id"))))
attributed = ranked.filter("rn = 1").select("d.*", F.col("f.position").alias("position"))
save("like_rate_by_position", attributed.groupBy("position").agg(
    F.count("*").alias("decisions"), F.avg("label").alias("like_rate")))

# Latest available catalog timestamp. This is an observation-window metric,
# NOT proof that an offer was never shown before instrumentation existed.
catalog = events.filter(F.col("type") == "catalog")
latest = events.filter(F.col("type") == "catalog_snapshot").agg(F.max("occurred_at").alias("snapshot"))
active = catalog.join(latest, catalog.occurred_at == latest.snapshot).select("offer_id", "job_family_id").distinct()
delivered = events.filter(F.col("type") == "impression").select("offer_id").distinct()
save("catalog_offers_without_impression", active.join(delivered, "offer_id", "left_anti"))

# A repeated match is paired with the most recent preceding candidate like.
m = events.filter(F.col("type") == "match").alias("m")
l = events.filter(F.col("type") == "like").alias("l")
pairs = m.join(l, (F.col("m.candidate_id") == F.col("l.candidate_id")) &
                 (F.col("m.offer_id") == F.col("l.offer_id")) &
                 (F.col("l.time") <= F.col("m.time")), "left")
pairs = pairs.withColumn("rn", F.row_number().over(Window.partitionBy("m.event_id").orderBy(F.col("l.time").desc())))
delays = pairs.filter("rn = 1").select(F.col("m.event_id"),
    (F.col("m.time").cast("double") - F.col("l.time").cast("double")).alias("seconds_from_like"))
save("match_delays", delays)
save("match_delay_summary", delays.agg(F.count("*").alias("matches"),
    F.count("seconds_from_like").alias("matches_with_observed_like"),
    F.avg("seconds_from_like").alias("mean_seconds")))

# Minimal educational model: position + one-hot family (never numeric family order).
# Candidate-based deterministic split prevents one candidate leaking across sets.
training = attributed.filter(F.col("position").isNotNull()).withColumn(
    "family", F.coalesce(F.col("job_family_id").cast("string"), F.lit("unknown")))
bucket = F.pmod(F.xxhash64("candidate_id"), F.lit(5))
train, test = training.filter(bucket != 0), training.filter(bucket == 0)
if train.count() >= 20 and train.select("label").distinct().count() == 2:
    pipeline = Pipeline(stages=[
        StringIndexer(inputCol="family", outputCol="family_index", handleInvalid="keep"),
        OneHotEncoder(inputCol="family_index", outputCol="family_vector"),
        VectorAssembler(inputCols=["position", "family_vector"], outputCol="features"),
        LogisticRegression(maxIter=30, regParam=0.1)])
    model = pipeline.fit(train)
    model.write().overwrite().save(root + "/like_model")
    names = ["position"] + ["family=" + x for x in model.stages[0].labels]
    weights = list(model.stages[-1].coefficients)
    save("model_coefficients", spark.createDataFrame(
        [(names[i] if i < len(names) else "unknown_family", float(w)) for i, w in enumerate(weights)],
        ["feature", "coefficient"]))
    if test.select("label").distinct().count() == 2:
        predictions = model.transform(test)
        like_probability = F.udf(lambda vector: float(vector[1]), "double")
        save("like_predictions", predictions.select("event_id", "label", "prediction",
             like_probability("probability").alias("like_probability")))
        auc = BinaryClassificationEvaluator().evaluate(predictions)
        save("model_evaluation", spark.createDataFrame([(float(auc), train.count(), test.count())], ["auc", "train_rows", "test_rows"]))
    else:
        print("No AUC: test set needs both classes.")
else:
    print("Model skipped: need >=20 attributed training decisions and both like/pass classes.")
save("run_summary", spark.createDataFrame([(args.source, run_id, events.count(), decisions.count())],
     ["source", "run_id", "events", "decisions"]))
print("Outputs:", root, "— associations only; no automatic change to ranking-rules.ts")
spark.stop()
