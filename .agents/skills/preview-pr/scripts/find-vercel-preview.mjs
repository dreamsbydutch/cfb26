#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const [repository, sha] = process.argv.slice(2)
const helpRequested =
  process.argv.includes('--help') || process.argv.includes('-h')

if (helpRequested) {
  console.log(
    'Usage: node find-vercel-preview.mjs <owner/repo> <full-commit-sha>',
  )
} else if (!repository || !sha) {
  console.error(
    'Usage: node find-vercel-preview.mjs <owner/repo> <full-commit-sha>',
  )
  process.exitCode = 64
} else if (
  !/^[\w.-]+\/[\w.-]+$/u.test(repository) ||
  !/^[a-f\d]{40,64}$/iu.test(sha)
) {
  console.error('Repository or full commit SHA is invalid.')
  process.exitCode = 64
} else {
  findPreview(repository, sha)
}

function ghApi(path, fields = []) {
  const args = ['api', '--method', 'GET', path]
  for (const [name, value] of fields) args.push('-f', `${name}=${value}`)

  const output = execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output)
}

function isVercelPreview(deployment) {
  const app = deployment.performed_via_github_app ?? {}
  const text = [
    deployment.environment,
    deployment.description,
    deployment.creator?.login,
    app.name,
    app.slug,
  ]
    .filter(Boolean)
    .join(' ')

  const preview =
    /preview/iu.test(deployment.environment ?? '') ||
    (deployment.transient_environment === true &&
      deployment.production_environment !== true)

  return preview && /vercel/iu.test(text)
}

function result(payload, exitCode) {
  console.log(JSON.stringify(payload, null, 2))
  process.exitCode = exitCode
}

function directEnvironmentUrl(value) {
  if (!value) return null

  try {
    const url = new URL(value)
    const dashboardHost =
      url.hostname === 'vercel.com' || url.hostname.endsWith('.vercel.com')
    return url.protocol === 'https:' && !dashboardHost ? url.href : null
  } catch {
    return null
  }
}

function findPreview(repo, commitSha) {
  try {
    const deployments = ghApi(`repos/${repo}/deployments`, [
      ['sha', commitSha],
      ['per_page', '100'],
    ])
      .filter(
        (deployment) =>
          deployment.sha?.toLowerCase() === commitSha.toLowerCase(),
      )
      .filter(isVercelPreview)
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )

    if (deployments.length === 0) {
      result({ state: 'not_found', repository: repo, sha: commitSha }, 0)
      return
    }

    const observed = []
    for (const deployment of deployments) {
      const statuses = ghApi(
        `repos/${repo}/deployments/${deployment.id}/statuses`,
        [['per_page', '100']],
      ).sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      const latest = statuses[0]
      const environmentUrl = directEnvironmentUrl(latest?.environment_url)

      observed.push({
        deploymentId: deployment.id,
        environment: deployment.environment,
        state: latest?.state ?? 'queued',
        environmentUrl,
        logUrl: latest?.log_url ?? latest?.target_url ?? null,
      })

      if (latest?.state === 'success' && environmentUrl) {
        result(
          {
            state: 'success',
            repository: repo,
            sha: commitSha,
            deploymentId: deployment.id,
            environment: deployment.environment,
            environmentUrl,
            logUrl: latest.log_url ?? latest.target_url ?? null,
          },
          0,
        )
        return
      }
    }

    const newestDeploymentFailed = ['error', 'failure', 'inactive'].includes(
      observed[0].state,
    )
    result(
      {
        state: newestDeploymentFailed ? 'failed' : 'pending',
        repository: repo,
        sha: commitSha,
        deployments: observed,
      },
      newestDeploymentFailed ? 1 : 0,
    )
  } catch (error) {
    const stderr = error?.stderr?.toString().trim()
    result(
      {
        state: 'lookup_error',
        repository: repo,
        sha: commitSha,
        error: stderr || error.message,
      },
      1,
    )
  }
}
