import { ethers } from "ethers";

// Tumhara Escrow Contract Address
const CONTRACT_ADDRESS = "0x529225162b86489fcbD6320b88C4BAEAAE586a67";
const RPC_URL = "https://worldchain-mainnet.g.alchemy.com/public";

// ABI mein backend ke liye refund / cancel function (Agar aapke contract mein function ka naam kuch aur hai jaise cancelMatch ya refundDeposit, toh yahan change kar lena)
const ABI = [
  "function refundMatch(bytes32 matchId, address player) external"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchId, playerAddress } = req.body;

  if (!matchId || !playerAddress) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1. Provider setup
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 2. Environment Variable se Private Key nikalna
    const privateKey = process.env.RESOLVER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error("Private Key is not set in environment variables");
    }

    const operatorWallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, operatorWallet);

    // 3. Frontend ke matching SHA-256 logic se matchId ko bytes32 mein convert karna
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(matchId));
    const bytes32MatchId = '0x' + Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`Refunding match ${matchId} for player ${playerAddress}...`);
    
    // 4. Contract par refund/cancel function call karna
    const tx = await contract.refundMatch(bytes32MatchId, playerAddress);

    // 5. Transaction complete hone ka wait karna
    const receipt = await tx.wait();
    console.log(`Refund processed successfully! TX Hash: ${receipt.hash}`);

    return res.status(200).json({ success: true, txHash: receipt.hash });

  } catch (error) {
    console.error("Refund error:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
}