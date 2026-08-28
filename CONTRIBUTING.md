# Contributing

Thanks for taking the time to contribute.

## Getting started

This project targets Node.js 24 or later (see `.nvmrc`). If you use `nvm`:

```sh
nvm use
```

Install dependencies:

```sh
npm install
```

## Running the tests

The package ships with a small integrity test suite run through the built-in
Node.js test runner:

```sh
npm test
```

For realistic testing, install the package into a GOV.UK Prototype Kit v13
prototype using a local path and use `examples/example-page.njk` as sample page
content:

```sh
npm install ../govuk-prototype-kit-changes
npm run dev
```

## Making changes

- Keep changes focused and page-local, in line with the v0.1 scope described in
  the [README](README.md).
- Match the existing code style (2-space indentation, single quotes in
  JavaScript). See `.editorconfig` for the shared editor settings.
- Add or update tests where it makes sense, and make sure `npm test` passes.
- Record notable changes under the `Unreleased` heading in
  [CHANGELOG.md](CHANGELOG.md).

## Submitting a pull request

1. Fork the repository and create a branch for your change.
2. Commit with clear, descriptive messages.
3. Open a pull request describing what changed and why.

## Licence

By contributing, you agree that your contributions will be licensed under the
[MIT Licence](LICENSE).
