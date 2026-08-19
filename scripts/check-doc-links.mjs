import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.tanstack',
  'convex/_generated',
  'dist',
  'node_modules',
])

function markdownFiles(directory, relative = '') {
  const current = resolve(directory, relative)
  const files = []

  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(child))
        files.push(...markdownFiles(directory, child))
    } else if (extname(entry.name).toLowerCase() === '.md') {
      files.push(resolve(directory, child))
    }
  }

  return files
}

function localTarget(rawTarget) {
  const trimmed = rawTarget.trim()
  const target = trimmed.startsWith('<')
    ? trimmed.slice(1, trimmed.indexOf('>'))
    : trimmed.split(/\s+["']/u, 1)[0]

  if (
    !target ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    /^[a-z][a-z\d+.-]*:/iu.test(target)
  ) {
    return null
  }

  return decodeURIComponent(target.split(/[?#]/u, 1)[0])
}

const errors = []
const files = markdownFiles(root)
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/gu

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(markdownLink)) {
    const target = localTarget(match[1])
    if (!target) continue

    const destination = resolve(dirname(file), target)
    if (!existsSync(destination)) {
      errors.push(`${file.slice(root.length + 1)} -> ${match[1]}`)
    }
  }
}

if (errors.length > 0) {
  console.error('Broken local Markdown links:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(
    `Checked ${files.length} Markdown files; all local links resolve.`,
  )
}
