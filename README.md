# zkC.R.E.A.M

[![Actions Status](https://github.com/couger-inc/cream/workflows/cream%20contract%20test/badge.svg)](https://github.com/couger-inc/cream/actions)

Zero-Knowledge Confidential Reliable Ethereum Anonymous Mixer

## Requirement

* `node` >= v14.0

## Regarding contained MACI packages
This monorepo contains a snapshot of packages from [MACI](https://github.com/appliedzkp/maci) v1 branch (6e2b1011198e59f61ca80404c97705b813a655c4) to be based on MACI 1.0.4 that uses Circom 2.0 based circuits.

## Setup

### Config file
Adjust [packages/config/prod.ts](./packages/config/prod.ts) as needed:

Make sure that you use the same merkle tree level in [packages/config/prod.ts](./packages/config/prod.ts) and [packages/circuits/prod/vote.circom](./packages/circuits/circom/prod/vote.circom).

### Building Cream

```bash
$ npx lerna bootstrap
$ npx lerna run build
```

## Running Tests
1. Build test-site for proof verification tests
   ```
   $ pushd packages/contracts
   $ yarn build:test-site
   $ popd
   ```
1. Run tests:
   ```
   $ yarn test
   ```

## TODO upon MACI 1.0.4 release
- call ./scripts/compileSol.sh in maci-contracts before running E2E tests
