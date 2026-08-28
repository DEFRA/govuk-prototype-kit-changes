const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('plugin config references files that exist', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'govuk-prototype-kit.config.json'), 'utf8'))

  for (const sass of config.sass) {
    assert.equal(fs.existsSync(path.join(root, sass)), true, `Missing ${sass}`)
  }

  for (const script of config.scripts) {
    assert.equal(fs.existsSync(path.join(root, script)), true, `Missing ${script}`)
  }

  for (const macro of config.nunjucksMacros) {
    const macroPath = path.join(root, config.nunjucksPaths[0], macro.importFrom)
    assert.equal(fs.existsSync(macroPath), true, `Missing ${macro.importFrom}`)
  }
})

test('plugin config exposes the two v0.1 macros', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'govuk-prototype-kit.config.json'), 'utf8'))
  assert.deepEqual(config.nunjucksMacros.map(({ macroName }) => macroName), [
    'prototypeChange',
    'prototypeChangeRemoved'
  ])
})
