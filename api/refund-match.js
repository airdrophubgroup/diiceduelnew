import { ethers } from "ethers";

const RPC_URL = process.env.WORLDCHAIN_RPC || "https://worldchain-mainnet.g.alchemy.com/public";
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = "0x2f9D3bC7125d563434cbc601b15Add6Ba0F3F3Db";
const PAYMENT_RECV_WALLET = "0x8FB70CDFb545C7D9b842cBE37B9aba84059Bf14b";

const ABI = [
  "function cancelWaitingMatch(bytes32 matchId) external",
  "function settleMatch(bytes32 matchId, address winner) external",
  "function withdrawPlatformFees(address to) external"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchIdBytes32, action, winnerAddress } = req.body;
  if (!matchIdBytes32) {
    return res.status(400).json({ error: 'matchIdBytes32 is required' });
  }

  if (!PRIVATE_KEY) {
    return res.status(500).json({ error: 'ADMIN_PRIVATE_KEY is not configured in Vercel' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    if (action === 'CANCEL_REFUND') {
      // 1. Refund user on-chain
      const tx = await contract.cancelWaitingMatch(matchIdBytes32);
      await tx.wait();
      return res.status(200).json({ success: true, action: 'REFUND_COMPLETED', txHash: tx.hash });

    } else if (action === 'SETTLE_WINNER') {
      if (!winnerAddress) {
        return res.status(400).json({ error: 'winnerAddress is required for settlement' });
      }

      // 2. Winner payout on-chain
      const tx = await contract.settleMatch(matchIdBytes32, winnerAddress);
      await tx.wait();

      // 3. Auto withdraw platform fee to Admin receiving wallet
      try {
        const feeTx = await contract.withdrawPlatformFees(PAYMENT_RECV_WALLET);
        await feeTx.wait();
      } catch (feErr) {
        console.warn("Auto-fee transfer notice:", feErr.message);
      }

      return res.status(200).json({ success: true, action: 'SETTLE_COMPLETED', txHash: tx.hash });
    } else {
      return res.status(400).json({ error: 'Invalid action provided' });
    }
  } catch (error) {
    console.error("Smart Contract Execution Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}