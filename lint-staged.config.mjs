import path from 'node:path'

function appCommand(service, appDirectory, binary, options, filenames) {
  const appFilenames = filenames
    .map((filename) => JSON.stringify(path.relative(appDirectory, filename)))
    .join(' ')

  return `docker compose exec -T ${service} ./node_modules/.bin/${binary} ${options} ${appFilenames}`
}

export default {
  'clientApp/**/*.{ts,tsx}': (filenames) => [
    appCommand('frontend', 'clientApp', 'eslint', '--fix', filenames),
    appCommand('frontend', 'clientApp', 'prettier', '--write', filenames),
  ],
  'backend/**/*.{ts,js}': (filenames) => [
    appCommand('backend', 'backend', 'eslint', '--fix', filenames),
    appCommand('backend', 'backend', 'prettier', '--write', filenames),
  ],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
}
