test:
    find programs tests | entr -csr 'anchor build && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/*.ts'

test-logs:
    find programs tests | entr -csr 'anchor build && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/*.ts'