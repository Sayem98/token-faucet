"use client";

import { useState, useEffect } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { FAUCET_ABI } from "../abis";
import { formatEther } from "viem";

type TransactionStatus = "idle" | "pending" | "success" | "error";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const contractAddress = "0xB66C982cE2720e38196D7672a31CA2ecF3ca6Ee4";

  // Reown Hooks
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  // Local State
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined); // Added state for Hash

  // --- WAGMI HOOKS START ---

  // 1. READ: Native Balance
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
    query: {
      enabled: !!address,
    },
  });

  // 2. READ: Check Cooldown Status
  const { data: cooldownSeconds, refetch: refetchCooldown } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: "getCooldownSeconds",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // 3. WRITE: Use writeContractAsync
  const {
    writeContractAsync, // <--- Key Change: Use Async version
    isPending: isWritePending,
    // Note: We handle errors manually in try/catch now, but can still use 'error' state if needed
  } = useWriteContract();

  // 4. WAIT: Watch for Transaction Receipt using the local txHash
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // --- WAGMI HOOKS END ---

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync Wagmi States to Local UI Status
  useEffect(() => {
    if (isWritePending || isConfirming) {
      setStatus("pending");
    } else if (isConfirmed) {
      setStatus("success");
      refetchCooldown();
    }
    // We removed the automatic error effect because we will catch errors directly in handleClaim
  }, [isWritePending, isConfirming, isConfirmed, refetchCooldown]);

  const handleClaim = async () => {
    if (!isConnected) return;

    setErrorMsg("");
    setStatus("pending");

    try {
      // Execute the transaction and wait for the user to sign
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: FAUCET_ABI,
        functionName: "claimTokens",
      });

      console.log("Tx Hash:", hash);
      setTxHash(hash); // Trigger the WaitForTransactionReceipt hook
    } catch (err: any) {
      console.error("Claim Error:", err);
      setStatus("error");

      // Better error messages
      if (err.message.includes("User rejected")) {
        setErrorMsg("Transaction rejected by user.");
      } else if (err.message.includes("Cooldown active")) {
        setErrorMsg("Cooldown is still active.");
      } else if (err.message.includes("Faucet is empty")) {
        setErrorMsg("Faucet is empty.");
      } else {
        setErrorMsg("Transaction failed. See console.");
      }
    }
  };

  const formatCooldown = (seconds: bigint | number) => {
    const s = Number(seconds);
    if (s <= 0) return null;
    const minutes = Math.floor(s / 60);
    const remainingSeconds = s % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const shortenAddress = (addr: string | undefined) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isMounted) return null;

  const isOnCooldown = cooldownSeconds ? Number(cooldownSeconds) > 0 : false;

  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <nav className="w-full max-w-md flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Faucet dApp
        </h1>
        <appkit-button />
      </nav>

      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Token Top-Up</h2>
          <p className="text-gray-400 text-sm">
            Claim testnet tokens instantly.
          </p>
        </div>

        {isConnected ? (
          <div className="bg-gray-900 rounded-lg p-4 space-y-3 border border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-green-400 font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Address</span>
              <span className="font-mono text-gray-200">
                {shortenAddress(address)}
              </span>
            </div>

            <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
              <span className="text-gray-400">Balance</span>
              <span className="text-xl font-bold">
                {balance?.value
                  ? `${Number(formatEther(balance.value)).toFixed(4)} ${balance.symbol}`
                  : "0.0000"}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-6 text-center space-y-4">
            <p className="text-blue-200 text-sm">
              Connect via Trust Wallet, MetaMask or Binance Wallet to continue.
            </p>
            <button
              onClick={() => open({ view: "Connect" })}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-semibold transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {status !== "idle" && (
          <div
            className={`p-4 rounded-lg border flex items-start gap-3 transition-all duration-300 ${
              status === "pending"
                ? "bg-blue-900/20 border-blue-500/50 text-blue-200"
                : status === "success"
                  ? "bg-green-900/20 border-green-500/50 text-green-200"
                  : "bg-red-900/20 border-red-500/50 text-red-200"
            }`}
          >
            <div className="mt-0.5">
              {status === "pending" && (
                <svg
                  className="animate-spin h-5 w-5 text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {status === "success" && (
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {status === "error" && (
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold">
                {status === "pending"
                  ? "Transaction Pending"
                  : status === "success"
                    ? "Claim Successful!"
                    : "Error"}
              </p>
              <p className="opacity-80 text-xs mt-1">
                {status === "pending" ? (
                  isWritePending ? (
                    "Please sign in wallet..."
                  ) : (
                    "Waiting for confirmation..."
                  )
                ) : status === "success" ? (
                  <a
                    href={`https://testnet.bscscan.com/tx/${txHash}`}
                    target="_blank"
                    className="underline hover:text-white"
                  >
                    View on Explorer
                  </a>
                ) : (
                  <span>{errorMsg}</span>
                )}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={!isConnected || status === "pending" || isOnCooldown}
          className={`w-full cursor-pointer py-4 rounded-xl font-bold text-lg transition-all duration-200 flex flex-col items-center justify-center
            ${
              isConnected && status !== "pending" && !isOnCooldown
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 active:scale-95 shadow-lg shadow-blue-900/50 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
        >
          {status === "pending" ? (
            "Processing..."
          ) : isOnCooldown ? (
            <span>Cooldown: {formatCooldown(cooldownSeconds as bigint)}</span>
          ) : (
            "Claim Tokens"
          )}
        </button>
      </div>
    </main>
  );
}
