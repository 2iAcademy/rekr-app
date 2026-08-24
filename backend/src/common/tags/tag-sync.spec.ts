import { Prisma } from '../../../generated/prisma/client';
import { normaliseTagLabels, resolveTagIds } from './tag-sync';

type TxMock = {
  tag: { createMany: jest.Mock; findMany: jest.Mock };
};

const buildTx = (): TxMock => ({
  tag: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue([]),
  },
});

const asTransactionClient = (tx: TxMock): Prisma.TransactionClient =>
  tx as unknown as Prisma.TransactionClient;

describe('normaliseTagLabels', () => {
  it('trims, drops blanks and collapses duplicates', () => {
    expect(
      normaliseTagLabels(['React', 'React ', ' React', '   ', '', 'Vue']),
    ).toEqual(['React', 'Vue']);
  });

  it('keeps distinct labels untouched', () => {
    expect(normaliseTagLabels(['CDI', 'Remote'])).toEqual(['CDI', 'Remote']);
  });
});

describe('resolveTagIds', () => {
  it('resolves any batch size in exactly two queries (no N+1)', async () => {
    const tx = buildTx();
    const labels = Array.from({ length: 50 }, (_, i) => `label-${i}`);
    tx.tag.findMany.mockResolvedValue(
      labels.map((_, index) => ({ id: index + 1 })),
    );

    const ids = await resolveTagIds(asTransactionClient(tx), labels, 'skill');

    expect(tx.tag.createMany).toHaveBeenCalledTimes(1);
    expect(tx.tag.findMany).toHaveBeenCalledTimes(1);
    expect(ids).toHaveLength(50);
  });

  it('creates with skipDuplicates and looks the labels back up', async () => {
    const tx = buildTx();
    tx.tag.findMany.mockResolvedValue([{ id: 7 }]);

    await resolveTagIds(asTransactionClient(tx), ['React'], 'skill');

    expect(tx.tag.createMany).toHaveBeenCalledWith({
      data: [{ label: 'React', category: 'skill' }],
      skipDuplicates: true,
    });
    // Scoped to the category: a label carries one row per category it is used
    // in, so looking it up on the label alone could hand back another one's.
    expect(tx.tag.findMany).toHaveBeenCalledWith({
      where: { label: { in: ['React'] }, category: 'skill' },
      select: { id: true },
    });
  });

  it('normalises before writing, so padded duplicates create one row', async () => {
    const tx = buildTx();
    tx.tag.findMany.mockResolvedValue([{ id: 7 }]);

    await resolveTagIds(
      asTransactionClient(tx),
      ['React', 'React ', '  '],
      'skill',
    );

    expect(tx.tag.createMany).toHaveBeenCalledWith({
      data: [{ label: 'React', category: 'skill' }],
      skipDuplicates: true,
    });
  });

  it('touches the database at all only when there is something to store', async () => {
    const tx = buildTx();

    const ids = await resolveTagIds(
      asTransactionClient(tx),
      ['  ', ''],
      'skill',
    );

    expect(ids).toEqual([]);
    expect(tx.tag.createMany).not.toHaveBeenCalled();
    expect(tx.tag.findMany).not.toHaveBeenCalled();
  });
});
