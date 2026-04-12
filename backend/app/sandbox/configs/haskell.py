"""
Haskell sandbox execution configuration (FR-20).

Compiles and runs the user's Haskell solution with HUnit tests.
"""

SETUP_COMMANDS = [
    "apt-get install -y ghc cabal-install --quiet",
    "cabal update --quiet",
    "cabal install HUnit --quiet",
]

RUNNER_COMMAND = "runghc SolutionTest.hs"
