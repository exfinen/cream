const { config } = require('@cream/config')
const { MerkleTree } = require('cream-merkle-tree')
const {
    createDeposit,
    rbigInt,
    toHex,
    pedersenHash,
    createMessage,
    bnSqrt,
} = require('libcream')
const { genProofAndPublicSignals } = require('@cream/circuits')
const {
    formatProofForVerifierContract,
    timeTravel,
    getIpfsHash,
    getDataFromIpfsHash,
    RECIPIENTS,
    takeSnapshot,
    revertSnapshot,
} = require('./TestUtil')
const { Keypair, Command, PrivKey } = require('maci-domainobjs')
const { genRandomSalt } = require('maci-crypto')
const { processAndTallyWithoutProofs } = require('maci-cli')
const { MaciState } = require('maci-core')
const { BigNumber } = require('@ethersproject/bignumber')
const truffleAssert = require('truffle-assertions')
const fs = require('fs')

const MACIFactory = artifacts.require('MACIFactory')
const CreamFactory = artifacts.require('CreamFactory')
const CreamVerifier = artifacts.require('CreamVerifier')
const VotingToken = artifacts.require('VotingToken')
const SignUpToken = artifacts.require('SignUpToken')
const Cream = artifacts.require('Cream')
const MACI = artifacts.require('MACI')
const SignUpTokenGatekeeper = artifacts.require('SignUpTokenGatekeeper')
const ConstantInitialVoiceCreditProxy = artifacts.require(
    'ConstantInitialVoiceCreditProxy'
)

contract('E2E', (accounts) => {
    describe('E2E', () => {
        let maciFactory
        let creamFactory
        let creamVerifier
        let votingToken
        let signUpToken
        let creamAddress
        let cream
        let maciAddress
        let maci
        let voteRecord = new Array(RECIPIENTS.length)
        let afterSetupSnapshot
        let tree

        const BALANCE = config.maci.initialVoiceCreditBalance
        const LEVELS = config.cream.merkleTrees
        const ZERO_VALUE = config.cream.zeroValue
        const IPFS_HASH = 'QmPChd2hVbrJ6bfo3WBcTW4iZnpHm8TEzWkLHmLpXhF68A'
        const batchSize = config.maci.messageBatchSize // 4
        const contractOwner = accounts[0]
        const coordinatorAddress = accounts[1]
        const coordinatorEthPrivKey =
            '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f'
        const coordinator = new Keypair(
            new PrivKey(BigInt(config.maci.coordinatorPrivKey))
        )

        const setupEnvironment = async () => {
            // owner deploys maci factory
            maciFactory = await MACIFactory.deployed()

            // owner deploys cream factory
            creamFactory = await CreamFactory.deployed()

            // owner transfers ownership from maci factory to cream factory
            await maciFactory.transferOwnership(creamFactory.address)

            // owner also deploys voting, sign up token and creamVerifier
            creamVerifier = await CreamVerifier.deployed()
            votingToken = await VotingToken.deployed()
            signUpToken = await SignUpToken.deployed()

            // owner deploys cream from cream factory
            const tx = await creamFactory.createCream(
                creamVerifier.address,
                votingToken.address,
                signUpToken.address,
                BALANCE,
                LEVELS,
                RECIPIENTS,
                IPFS_HASH,
                coordinator.pubKey.asContractParam(),
                coordinatorAddress
            )
            creamAddress = tx.logs[4].args[0]
            cream = await Cream.at(creamAddress)
            maciAddress = await cream.maci()
            maci = await MACI.at(maciAddress)

            // transfer ownership of sign up token to cream
            await signUpToken.transferOwnership(cream.address)
        }

        const resetVotes = () => {
            tree = new MerkleTree(LEVELS, ZERO_VALUE)
            for (let i = 0; i < voteRecord.length; ++i) {
                voteRecord[i] = 0
            }
        }

        const signUp2Maci = async (
            voter, // account
            voterIndex,
            keypair
        ) => {
            // give 1 voting token to voter
            await votingToken.giveToken(voter)
            await votingToken.setApprovalForAll(creamAddress, true, {
                from: voter,
            })

            // voter send deposit the voting token to cream
            const deposit = createDeposit(rbigInt(31), rbigInt(31))
            tree.insert(deposit.commitment)
            await cream.deposit(toHex(deposit.commitment), { from: voter })

            // build proof that voter deposited voting token
            const root = tree.root
            const merkleProof = tree.getPathUpdate(voterIndex)
            const input = {
                root,
                nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31))
                    .babyJubX,
                nullifier: deposit.nullifier,
                secret: deposit.secret,
                path_elements: merkleProof[0],
                path_index: merkleProof[1],
            }
            const { proof } = await genProofAndPublicSignals(
                input,
                `${process.env.NODE_ENV}/vote.circom`,
                'build/vote.zkey',
                'circuits/vote.wasm'
            )

            // ask cream to sign up the public key to maci w/ the deposit proof
            const args = [toHex(input.root), toHex(input.nullifierHash)]
            const voterPubKey = keypair.pubKey.asContractParam()
            const formattedProof = formatProofForVerifierContract(proof)
            await cream.signUpMaci(voterPubKey, formattedProof, ...args, {
                from: voter,
            })
        }

        const letAllVotersVote = async (voterKeypairs, nonce) => {
            for (let i = 0; i < batchSize; i++) {
                const voter = accounts[i + 2]
                const voiceCredits = BigNumber.from(2) // bnSqrt(BigNumber.from(2)) = 0x01, BigNumber
                const voiceCreditsSqrtNum = bnSqrt(voiceCredits).toNumber()
                const voterKeypair = voterKeypairs[i]

                const voteRecipient = i % RECIPIENTS.length // need adjustment since batch size differs from RECIPIENT size

                // create maci vote to voteRecipient
                const [message, encPubKey] = createMessage(
                    i + 1,
                    voterKeypair,
                    null,
                    coordinator.pubKey,
                    voteRecipient,
                    voiceCredits,
                    nonce,
                    genRandomSalt()
                )
                voteRecord[voteRecipient] += voiceCreditsSqrtNum

                await signUp2Maci(voter, i, voterKeypair)

                // voter publishes vote message to maci
                await maci.publishMessage(
                    message.asContractParam(),
                    encPubKey.asContractParam(),
                    { from: voter }
                )
            }
        }

        const timeTravel2EndOfVotingPeriod = async () => {
            const duration = config.maci.signUpDurationInSeconds

            // time travel to the end of sign-up period
            await timeTravel(duration)

            // time travel to the end of voting period
            await timeTravel(duration)
        }

        const tally = async () => {
            const tally_file = 'build/tally.json'
            let tally
            try {
                //  12. coordinator process messages
                //  13. coordinator prove vote tally
                //  14. coordinator create tally.json from tally command
                tally = await processAndTallyWithoutProofs({
                    contract: maciAddress,
                    eth_privkey: coordinatorEthPrivKey,
                    privkey: coordinator.privKey.serialize(),
                    tally_file,
                })
            } finally {
                if (fs.existsSync(tally_file)) {
                    fs.unlinkSync(tally_file)
                }
            }

            // coordinator publishes tally hash
            const tallyHash = await getIpfsHash(JSON.stringify(tally))
            await cream.publishTallyHash(tallyHash, {
                from: coordinatorAddress,
            })
            // owner approves tally
            await cream.approveTally({ from: contractOwner })
        }

        const getTallyResult = async () => {
            const hash = await cream.tallyHash()
            const result = await getDataFromIpfsHash(hash)
            const tallyResult = JSON.parse(result).results.tally.map((x) =>
                Number(x)
            )
            return tallyResult
        }

        before(async () => {
            await setupEnvironment()
            afterSetupSnapshot = await takeSnapshot()
        })

        beforeEach(async () => {
            resetVotes()
        })

        afterEach(async () => {
            await revertSnapshot(afterSetupSnapshot.result)
            //afterSetupSnapshot = await takeSnapshot()
        })

        // describe('key pair change', () => {
        //     beforeEach(async () => {
        //         resetVotes()
        //     })

        //     afterEach(async () => {
        //         await revertSnapshot(afterSetupSnapshot.result)
        //         //afterSetupSnapshot = await takeSnapshot()
        //     })
        //     it('should invalidate previous votes after key pair change', () => {

        //     })

        //     it('should reject votes w/ old key after key pair change', () => {})
        //     it('should accept votes w/ new key after key pair change', () => {})
        // })

        it('should have processed all messages as valid messages', async () => {
            const voterKeypairs = [...Array(batchSize)].map(
                (_) => new Keypair()
            )
            const nonce = 1
            await letAllVotersVote(voterKeypairs, nonce)
            await timeTravel2EndOfVotingPeriod()
            await tally()

            const tallyResult = await getTallyResult()

            const expected = voteRecord
            const actual = tallyResult.slice(0, RECIPIENTS.length)
            assert.deepEqual(actual, expected)
        })

        //  17. coordinator withdraw deposits and transfer to recipient
        it('should correctly transfer voting token to recipient', async () => {
            const voterKeypairs = [...Array(batchSize)].map(
                (_) => new Keypair()
            )
            const nonce = 1
            await letAllVotersVote(voterKeypairs, nonce)
            await timeTravel2EndOfVotingPeriod()
            await tally()

            const tallyResult = await getTallyResult()

            for (let i = 0; i < RECIPIENTS.length; i++) {
                // transfer tokens voted to recipient currently owned by cream to recipient
                const counts = tallyResult[i]
                for (let j = 0; j < counts; j++) {
                    const tx = await cream.withdraw(i, {
                        from: coordinatorAddress,
                    })
                    truffleAssert.eventEmitted(tx, 'Withdrawal')
                }

                // check if number of token voted matches w/ recipient token balance
                const numTokens = await votingToken.balanceOf(RECIPIENTS[i])
                assert.equal(tallyResult[i], numTokens.toString())
            }
        })
    })
})
