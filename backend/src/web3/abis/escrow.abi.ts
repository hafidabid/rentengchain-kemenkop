/**
 * Hand-authored minimal ABI for TanggungRentengEscrow — only the methods the
 * demo flows call. Signatures transcribed from foundry/src/TanggungRentengEscrow.sol.
 * The full compiled ABI can replace this later via `forge build`.
 */
export const ESCROW_ABI = [
  {
    type: 'function',
    name: 'registerMember',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'memberHash', type: 'bytes32' },
      { name: 'koperasiId', type: 'bytes32' },
      { name: 'wallet', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'joinGroup',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupId', type: 'bytes32' },
      { name: 'memberHash', type: 'bytes32' },
      { name: 'inviteCodeHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordSavings',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'memberHash', type: 'bytes32' },
      { name: 'jenis', type: 'uint8' },
      { name: 'nominal', type: 'uint256' },
      { name: 'metode', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fundSocialFund',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'createLoan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'groupId', type: 'bytes32' },
      { name: 'memberHash', type: 'bytes32' },
      { name: 'nominal', type: 'uint256' },
      { name: 'tenor', type: 'uint64' },
      { name: 'cicilanBulanan', type: 'uint256' },
      { name: 'skorAi', type: 'uint8' },
      { name: 'flagAi', type: 'uint8' },
      { name: 'paramsHash', type: 'bytes32' },
      { name: 'firstDueDate', type: 'uint256' },
    ],
    outputs: [{ name: 'loanId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'recordScreening',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'skorAi', type: 'uint8' },
      { name: 'flagAi', type: 'uint8' },
      { name: 'paramsHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveLoan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'disburseLoan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deferLoan',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'loanId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordRepayment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'onTime', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'applySocialFund',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'period', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'activateRenteng',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repayTalangan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fileAppeal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'reasonHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'resolveAppeal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'loanId', type: 'uint256' },
      { name: 'accepted', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

// Enum orderings from foundry/src/interfaces/IRRTypes.sol — submitted on-chain as uint8.
export enum SavingsType {
  POKOK = 0,
  WAJIB = 1,
  SUKARELA = 2,
}
export enum PaymentMethod {
  QRIS = 0,
  CASH = 1,
}
export enum AIFlag {
  HIJAU = 0,
  KUNING = 1,
  MERAH = 2,
}
