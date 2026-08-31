// This performs a FORMAT check only. It does not query BscScan or any blockchain -
// this is a demo project and no real transaction is ever verified on-chain.
// A real product would call a block explorer API (e.g. BscScan) server-side here.

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function validateTxId(txId) {
  if (!txId || typeof txId !== 'string') {
    return { valid: false, status: 'unverified', reason: 'No transaction ID provided' };
  }
  const trimmed = txId.trim();
  if (!TX_HASH_REGEX.test(trimmed)) {
    return {
      valid: false,
      status: 'invalid_format',
      reason: 'Does not match a BEP20 transaction hash format (0x + 64 hex characters)',
    };
  }
  return { valid: true, status: 'format_valid', reason: 'Transaction ID format looks valid (demo check only, not verified on-chain)' };
}

module.exports = { validateTxId };
