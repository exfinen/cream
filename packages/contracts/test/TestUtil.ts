import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import hre from 'hardhat'
import { expect } from 'chai'
import { Contract, ContractFactory } from '@ethersproject/contracts'
import { Keypair, PrivKey } from 'maci-domainobjs'
import { config } from '@cream/config'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers'
import { G1Point, G2Point } from 'maci-crypto'
import { VerifyingKey } from 'maci-domainobjs'

const { MaciState } = require('maci-core')
const { MerkleTree } = require('cream-merkle-tree')
const {
  genProofAndPublicSignals,
} = require('@cream/circuits')
const { toHex, createDeposit, pedersenHash, rbigInt } = require('libcream')
const { waffle } = require("hardhat");

const ethers = (hre as any).ethers
const deployments = hre.deployments

export interface Voter {
  signer: SignerWithAddress
  keypair: Keypair
}

export interface BaseEnv {
  AccQueueQuinaryBlankSl: ContractFactory,
  AccQueueQuinaryMaci: ContractFactory,
  ConstantInitialVoiceCreditProxy: ContractFactory,
  Cream: ContractFactory,
  CreamFactory: ContractFactory,
  creamVerifier: Contract,
  Maci: ContractFactory,
  MaciFactory: ContractFactory,
  MessageAqFactory: ContractFactory,
  Poll: ContractFactory,
  PollDeployer: ContractFactory,
  PollFactory: ContractFactory,
  PollProcessorAndTallyer: ContractFactory,
  provider: any,
  signers: { [name: string]: SignerWithAddress },
  voteRecipients: SignerWithAddress[],
  SignUpToken: ContractFactory,
  SignUpTokenGatekeeper: ContractFactory,
  Verifier: ContractFactory,
  VkRegistry: ContractFactory,
  voterSigners: SignerWithAddress[],
  VotingToken: ContractFactory,
}

export const createBaseEnv: (options?: unknown) => Promise<BaseEnv> = deployments.createFixture(async () => {
  await deployments.fixture()
  const poseidon = await ethers.getContract('Poseidon')
  const poseidonT3 = await ethers.getContract('PoseidonT3')
  const poseidonT4 = await ethers.getContract('PoseidonT4')
  const poseidonT5 = await ethers.getContract('PoseidonT5')
  const poseidonT6 = await ethers.getContract('PoseidonT6')

  const VotingToken = await ethers.getContractFactory('VotingToken')
  const VkRegistry = await ethers.getContractFactory('VkRegistry')
  const PollDeployer = await ethers.getContractFactory('PollDeployer')
  const SignUpTokenGatekeeper = await ethers.getContractFactory(
    'SignUpTokenGatekeeper'
  )
  const SignUpToken = await ethers.getContractFactory('SignUpToken')

  const [
    contractOwner, coordinator,
    voter1, voter2,
    voteRecipient1, voteRecipient2, voteRecipient3, voteRecipient4, voteRecipient5,
  ] =
    await getUnnamedAccounts(hre)
  const signers = { contractOwner, coordinator }
  const voteRecipients = [ voteRecipient1, voteRecipient2, voteRecipient3, voteRecipient4, voteRecipient5 ]

  const ConstantInitialVoiceCreditProxy: ContractFactory = await ethers.getContractFactory(
    'ConstantInitialVoiceCreditProxy'
  )
  // const constantInitialVoiceCreditProxy =
  //   await ConstantInitialVoiceCreditProxy.deploy(
  //     config.maci.initialVoiceCreditBalance
  //   )
  const Cream: ContractFactory = await ethers.getContractFactory('Cream', {
    libraries: {
      Poseidon: poseidon.address,
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
  })
  const CreamFactory: ContractFactory = await ethers.getContractFactory('CreamFactory', {
    libraries: {
      Poseidon: poseidon.address,
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
  })
  const AccQueueQuinaryBlankSl: ContractFactory = await ethers.getContractFactory(
    'AccQueueQuinaryBlankSl',
    {
      libraries: {
        PoseidonT3: poseidonT3.address,
        PoseidonT4: poseidonT4.address,
        PoseidonT5: poseidonT5.address,
        PoseidonT6: poseidonT6.address,
      },
    }
  )
  const AccQueueQuinaryMaci: ContractFactory = await ethers.getContractFactory(
    'AccQueueQuinaryMaci',
    {
      libraries: {
        PoseidonT3: poseidonT3.address,
        PoseidonT4: poseidonT4.address,
        PoseidonT5: poseidonT5.address,
        PoseidonT6: poseidonT6.address,
      },
    }
  )
  const MaciFactory: ContractFactory = await ethers.getContractFactory('MACIFactory', {
    libraries: {
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
    signer: contractOwner,
  })
  const MessageAqFactory: ContractFactory = await ethers.getContractFactory(
    'MessageAqFactory',
    {
      libraries: {
        PoseidonT3: poseidonT3.address,
        PoseidonT4: poseidonT4.address,
        PoseidonT5: poseidonT5.address,
        PoseidonT6: poseidonT6.address,
      },
    }
  )
  const PollFactory: ContractFactory = await ethers.getContractFactory('PollFactory', {
    libraries: {
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
  })

  const Maci: ContractFactory = await ethers.getContractFactory('MACI', {
    libraries: {
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
  })
  const Poll: ContractFactory = await ethers.getContractFactory('Poll', {
    libraries: {
      PoseidonT3: poseidonT3.address,
      PoseidonT4: poseidonT4.address,
      PoseidonT5: poseidonT5.address,
      PoseidonT6: poseidonT6.address,
    },
  })

  const creamVerifier: Contract = await ethers.getContract('CreamVerifier')
  const voterSigners = [voter1, voter2] //, voter3, voter4, voter5]

  const Verifier: ContractFactory = await ethers.getContractFactory('Verifier')
  const PollProcessorAndTallyer: ContractFactory = await ethers.getContractFactory(
    'PollProcessorAndTallyer'
  )
  const provider = waffle.provider

  const baseEnv: BaseEnv = {
    AccQueueQuinaryBlankSl,
    AccQueueQuinaryMaci,
    Cream,
    CreamFactory,
    creamVerifier,
    ConstantInitialVoiceCreditProxy,
    Maci,
    MaciFactory,
    MessageAqFactory,
    Poll,
    PollDeployer,
    PollFactory,
    PollProcessorAndTallyer,
    provider,
    signers,
    voteRecipients,
    SignUpToken,
    SignUpTokenGatekeeper,
    Verifier,
    VkRegistry,
    voterSigners,
    VotingToken,
  }
  return baseEnv
})

export interface TestState {
  maci: Contract,
  cream: Contract,
  signUpToken: Contract,
  votingToken: Contract,
  maciState: any,
  maciStatePoll: any,
  emptyTally: bigint[],
  voters: Voter[],
}

// create MACI, MACIState and sign up to both
export const createInitialTestStateAndSignUp = async (
  B: BaseEnv,
  testTreeDepths: TestTreeDepths,
  votingDuration: number,
  messageBatchSize: number,
) => {
  const maxValues = {
    maxUsers: 10,
    maxMessages: 10,
    maxVoteOptions: 25,  // this must match w/ contract's maxValues counterpart
  }

  const signUpToken: Contract = await B.SignUpToken.deploy()

  const { maci: _maci } = await createMACI4Testing(
    B.ConstantInitialVoiceCreditProxy,
    coordinatorEdDSAKeypair,
    B.Maci,
    B.MessageAqFactory,
    B.PollDeployer,
    B.PollFactory,
    signUpToken,
    B.SignUpTokenGatekeeper,
    testTreeDepths,
    B.VkRegistry,
    votingDuration
  )
  const maci: Contract = _maci

  const maciPollAddr = await maci.getPoll(0)
  const maciPoll = await B.Poll.attach(maciPollAddr)
  const deployTimeDuration = await maciPoll.getDeployTimeAndDuration()
  const maciPollDeployTime = BigInt(deployTimeDuration[0])
  const maciPollVotingDuration = BigInt(deployTimeDuration[1])

  const maciState = createMaciState()

  const pollEndTimestamp: bigint = maciPollDeployTime + maciPollVotingDuration
  const pollId = maciState.deployPoll(
    maciPollVotingDuration,
    pollEndTimestamp,
    maxValues,
    testTreeDepths,
    messageBatchSize,
    coordinatorEdDSAKeypair
  )
  const maciStatePoll = maciState.polls[pollId]

  const votingToken: Contract = await B.VotingToken.deploy()

  const { cream: _cream } = await createCream4Testing(
    B.signers.coordinator,
    B.Cream,
    B.creamVerifier.address,
    B.Maci,
    _maci.address,
    3, // merkleTreeHeight // this needs to match w/ MACI's state tree height which in this test is 3
    B.signers.contractOwner, // owner signer
    config.maci.signUpDurationInSeconds,
    B.SignUpToken,
    signUpToken.address,
    B.voteRecipients,
    config.maci.votingDurationInSeconds,
    B.VotingToken,
    votingToken.address
  )
  const cream: Contract = _cream
  await signUpToken.transferOwnership(cream.address)

  // all votee initially has zero vote
  const emptyTally: bigint[] = []
  for (let i = 0; i < 5 ** testTreeDepths.voteOptionTreeDepth; i++) {
    emptyTally[i] = BigInt(0)
  }

  // create voters w/ keypair
  const voters: Voter[] = []
  for (const [i, voterSigner] of B.voterSigners.entries()) {
    voters.push({
      signer: voterSigner,
      keypair: new Keypair(),
    })
  }

  // let all voters sign up w/ MACI
  const localMerkleTree = buildLevel3LocalMerkleTree()

  for (const [i, voter] of voters.entries()) {
    // give voting token to voter
    await votingToken.giveToken(voter.signer.address)
    await votingToken
      .connect(voter.signer)
      .setApprovalForAll(cream.address, true)

    // create commitment for the voter and insert it to localMerkleTree
    const deposit = createDeposit(rbigInt(31), rbigInt(31))
    localMerkleTree.insert(deposit.commitment)

    // deposit voting token to cream
    await cream.connect(voter.signer).deposit(toHex(deposit.commitment))

    // merkle root after inserting user's commitment
    const root = localMerkleTree.root

    // get path to the root from the voter's leaf node
    const merkleProof = localMerkleTree.getPathUpdate(i)

    // input for generating proof of voter's vote
    const input = {
      root,
      nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31))
        .babyJubX,
      nullifier: deposit.nullifier,
      secret: deposit.secret,
      path_elements: merkleProof[0],
      path_index: merkleProof[1],
    }
    // create proof of vote
    const { proof } = await buildProofWithLevel3VoteCircuit(input)

    const args = [toHex(input.root), toHex(input.nullifierHash)]
    const voterPubKey = voter.keypair.pubKey.asContractParam()
    const strBasedMaciProof = buildStrBasedMaciProof(proof)

    // sign up timestamp must match in MACI and MACIState
    const timestamp = await getNextBlockTimestamp()
    await setNextBlockTimestamp(timestamp)

    await cream
      .connect(voter.signer)
      .signUpMaci(voterPubKey, strBasedMaciProof, ...args)

    maciState.signUp(
      voter.keypair.pubKey,
      BigInt(BALANCE),
      BigInt(timestamp)
    )
  }

  const testState: TestState = {
    maci,
    cream,
    signUpToken,
    votingToken,
    maciState,
    maciStatePoll,
    emptyTally,
    voters,
  }
  return testState
}
export interface TestTreeDepths {
  messageTreeDepth: number,
  messageTreeSubDepth: number,
  voteOptionTreeDepth: number,
  intStateTreeDepth: number,
}

export interface SnarkJsVKey {
  protocol: "groth16",
  curve: "bn128",
  nPublic: number,  // 1
  vk_alpha_1: string[3],  // [bn, bn, number]
  vk_beta_2: string[3][2],  // [bn[2], bn[2], number[2]]
  vk_gamma_2: string[3][2],  // [bn[2], bn[2], number[2]]
  vk_delta_2: string[3][2],  // [bn[2], bn[2], number[2]]
  vk_alphabeta_12: string[2][3][2],  // [bn[2], bn[2], number[2]][2]
  IC: string[2][3],  // [bn, bn, number][2]
}

export const buildMaciVerifyingKey = (vKey: SnarkJsVKey): VerifyingKey => {
  return new VerifyingKey(
    new G1Point(
      BigInt(vKey.vk_alpha_1[0]),
      BigInt(vKey.vk_alpha_1[1]),
    ),
    new G2Point(
      [
        BigInt(vKey.vk_beta_2[0][1]),
        BigInt(vKey.vk_beta_2[0][0]),
      ],
      [
        BigInt(vKey.vk_beta_2[1][1]),
        BigInt(vKey.vk_beta_2[1][0]),
      ],
    ),
    new G2Point(
      [
        BigInt(vKey.vk_gamma_2[0][1]),
        BigInt(vKey.vk_gamma_2[0][0]),
      ],
      [
        BigInt(vKey.vk_gamma_2[1][1]),
        BigInt(vKey.vk_gamma_2[1][0]),
      ],
    ),
    new G2Point(
      [
        BigInt(vKey.vk_delta_2[0][1]),
        BigInt(vKey.vk_delta_2[0][0]),
      ],
      [
        BigInt(vKey.vk_delta_2[1][1]),
        BigInt(vKey.vk_delta_2[1][0]),
      ],
    ),
    [
      new G1Point(
        BigInt(vKey.IC[0][0]),
        BigInt(vKey.IC[0][1]),
      ),
      new G1Point(
        BigInt(vKey.IC[1][0]),
        BigInt(vKey.IC[1][1]),
      ),
    ]
  )
}

export interface SnarkJsProof {
  pi_a: string[3],  // [bn, bn, number]
  pi_b: string[3][2],  // [[bn, bn], [bn, bn], [number, number]]
  pi_c: string[3],  // [bn, bn, number]
  protocol: "groth16",
  curve: "bn128"
}

export const buildMaciProof = (proof: SnarkJsProof): bigint[] => {
  return [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ]
}

export const buildStrBasedMaciProof = (proof: SnarkJsProof) => {
  return buildMaciProof(proof).map(x => x.toString())
}

export const createMaciState = () => {
  return new MaciState()
}

export const getUnnamedAccounts = async (hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.getUnnamedAccounts()
  return await Promise.all(accounts.map(async (x) => hre.ethers.getSigner(x)))
}

export interface ContractEvent {
  name: string
  args: any[]
}

export const extractEvents = async (tx: any): Promise<ContractEvent[]> => {
  const receipt = await tx.wait()
  const events: ContractEvent[] = receipt.events
    .filter((x: any) => x.event)
    .map((x: any) => {
      return { name: x.event, args: x.args }
    })
  return events
}

export const extractEventsOfName = async (
  tx: any,
  name: string
): Promise<ContractEvent[]> => {
  const events = await extractEvents(tx)
  return events.filter((x) => x.name === name)
}

export const expectSingleEvent = async (tx: any, name: string) => {
  const events = await extractEvents(tx)
  const fltEvents = events.filter((x) => x.name === name)
  expect(fltEvents.length).to.equal(1)
}

export const extractSignelEventArg = async (
  tx: any,
  name: string,
  argIndex: number
) => {
  const events = await extractEventsOfName(tx, name)
  expect(events.length).to.equal(1)
  return events[0].args[argIndex]
}

export const extractSingleEventArg1 = async (tx: any, name: string) =>
  extractSignelEventArg(tx, name, 0)

export const getNextBlockTimestamp = async () =>
  (await hre.ethers.provider.getBlock('latest')).timestamp + 1

export const setNextBlockTimestamp = async (timestamp: number) =>
  hre.network.provider.send('evm_setNextBlockTimestamp', [timestamp])

export const endVotingPeriod = async () => {
  const endOfVotingPeriod = (await getNextBlockTimestamp()) + config.maci.votingDurationInSeconds
  await setNextBlockTimestamp(endOfVotingPeriod)
  return endOfVotingPeriod
}

export const coordinatorEdDSAKeypair = new Keypair(
  new PrivKey(BigInt(config.maci.coordinatorPrivKey))
)

export const ZERO_VALUE = config.cream.zeroValue
export const LEVELS = config.cream.merkleTreeDepth
export const BALANCE = config.maci.initialVoiceCreditBalance
export const IPFS_HASH = 'QmPChd2hVbrJ6bfo3WBcTW4iZnpHm8TEzWkLHmLpXhF68A'

export const createLocalMerkleTree = (levels: number = LEVELS) => {
  return new MerkleTree(levels, ZERO_VALUE)
}

// due to a bug in 1.0.2, MACI.signUp only works w/ state tree depth 3 or less
export const buildLevel3LocalMerkleTree = () => createLocalMerkleTree(3)

// build vote circuit w/ level = 3 to get around a bug in 1.0.2
export const buildProofWithLevel3VoteCircuit = async (input: any) => {
  return await genProofAndPublicSignals(
    input,
    `${process.env.NODE_ENV}/vote3.circom`,
    'build/vote.zkey',
    'circuits/vote.wasm'
  )
}

// create MACI instance whose owner is the default signer for testing purpose
// following the way MACIFactory creates it
export const createMACI4Testing = async (
  ConstantInitialVoiceCreditProxy: ContractFactory,
  coordinatorEdDSAKeypair: Keypair,
  Maci: ContractFactory,
  MessageAqFactory: ContractFactory,
  PollDeployer: ContractFactory,
  PollFactory: ContractFactory,
  signUpToken: Contract,
  SignUpTokenGatekeeper: ContractFactory,
  testTreeDepths: TestTreeDepths,
  VkRegistry: ContractFactory,
  votingDuration: number,
) => {
  const signUpTokenGatekeeper = await SignUpTokenGatekeeper.deploy(
    signUpToken.address
  )

  const constantInitialVoiceCreditProxy =
    await ConstantInitialVoiceCreditProxy.deploy(
      config.maci.initialVoiceCreditBalance
    )
  const pollFactory = await PollFactory.deploy()
  const messageAqFactory = await MessageAqFactory.deploy()
  await messageAqFactory.transferOwnership(pollFactory.address)

  const maci = await Maci.deploy(
    pollFactory.address,
    signUpTokenGatekeeper.address,
    constantInitialVoiceCreditProxy.address
  )
  await pollFactory.transferOwnership(maci.address)
  const vkRegistry = await VkRegistry.deploy()
  await maci.init(vkRegistry.address, messageAqFactory.address)

  const pollDeployer = await PollDeployer.deploy()

  const pubkey = coordinatorEdDSAKeypair.pubKey.asContractParam()
  await pollDeployer.deploy(
    maci.address,
    testTreeDepths.intStateTreeDepth,
    testTreeDepths.messageTreeSubDepth,
    testTreeDepths.messageTreeDepth,
    testTreeDepths.voteOptionTreeDepth,
    votingDuration,
    pubkey.x, // uint256 _coordinatorPubkeyX,
    pubkey.y, // uint256 _coordinatorPubkeyY
  )

  return {
    maci,
  }
}

// // create MACI instance whose owner is the default signer for testing purpose
// // following the way MACIFactory creates it
// export const createMACI4Testing = async (
//   ConstantInitialVoiceCreditProxy: ContractFactory,
//   coordinatorEdDSAKeypair: Keypair,
//   Maci: ContractFactory,
//   MessageAqFactory: ContractFactory,
//   messageTreeDepth: number,
//   messageTreeSubDepth: number,
//   PollDeployer: ContractFactory,
//   PollFactory: ContractFactory,
//   signUpToken: Contract,
//   SignUpTokenGatekeeper: ContractFactory,
//   stateTreeDepth: number,
//   VkRegistry: ContractFactory,
//   voteOptionTreeDepth: number,
//   votingDuration: number,
// ) => {
//   const signUpTokenGatekeeper = await SignUpTokenGatekeeper.deploy(
//     signUpToken.address
//   )

//   const constantInitialVoiceCreditProxy =
//     await ConstantInitialVoiceCreditProxy.deploy(
//       config.maci.initialVoiceCreditBalance
//     )
//   const pollFactory = await PollFactory.deploy()
//   const messageAqFactory = await MessageAqFactory.deploy()
//   await messageAqFactory.transferOwnership(pollFactory.address)

//   const maci = await Maci.deploy(
//     pollFactory.address,
//     signUpTokenGatekeeper.address,
//     constantInitialVoiceCreditProxy.address
//   )
//   await pollFactory.transferOwnership(maci.address)
//   const vkRegistry = await VkRegistry.deploy()
//   await maci.init(vkRegistry.address, messageAqFactory.address)

//   const pollDeployer = await PollDeployer.deploy()

//   const pubkey = coordinatorEdDSAKeypair.pubKey.asContractParam()
//   await pollDeployer.deploy(
//     maci.address,
//     stateTreeDepth,
//     messageTreeSubDepth,
//     messageTreeDepth,
//     voteOptionTreeDepth,
//     votingDuration,
//     pubkey.x, // uint256 _coordinatorPubkeyX,
//     pubkey.y, // uint256 _coordinatorPubkeyY
//   )

//   return {
//     maci,
//   }
// }

export const createCream4Testing = async (
  coordinator: SignerWithAddress,
  Cream: ContractFactory,
  creamVerifierAddr: string,
  Maci: ContractFactory,
  maciAddr: string,
  merkleTreeHeight: number,
  ownerSigner: SignerWithAddress,
  signUpDuration: number,
  SignUpToken: ContractFactory,
  signUpTokenAddr: string,
  voterSigners: SignerWithAddress[],
  votingDuration: number,
  VotingToken: ContractFactory,
  votingTokenAddr: string
) => {
  const maci = await Maci.attach(maciAddr)
  const signUpToken = await SignUpToken.attach(signUpTokenAddr)
  const votingToken = await VotingToken.attach(votingTokenAddr)

  const cream = await Cream.deploy(
    creamVerifierAddr,
    votingToken.address,
    merkleTreeHeight,
    voterSigners.map((x) => x.address),
    coordinator.address,
    signUpDuration,
    votingDuration
  )
  await cream.setMaci(maci.address, signUpToken.address)
  await cream.transferOwnership(ownerSigner.address)

  return { cream }
}
