import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatEther,
  parseEther,
  keccak256,
  solidityPacked
} from "ethers";
import { MerkleTree } from "merkletreejs";
import contractJson from "../contracts/MyNFT.json";
import allowlist from "../data/allowlist.json";

const SALE_STATE_LABELS = {
  0: "Paused",
  1: "Allowlist",
  2: "Public"
};

function hashAddress(address) {
  return keccak256(solidityPacked(["address"], [address]));
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [mintCount, setMintCount] = useState("0");
  const [maxSupply, setMaxSupply] = useState("10000");
  const [saleStatus, setSaleStatus] = useState("Paused");
  const [mintPrice, setMintPrice] = useState("0");
  const [txStatus, setTxStatus] = useState("Idle");

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const rpcUrlRaw = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545";
  const rpcUrl = rpcUrlRaw.replace("hardhat-node", "localhost");

  const allowlistTree = useMemo(() => {
    const leaves = allowlist.map((addr) => hashAddress(addr));
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }, []);

  const readContract = useCallback(async () => {
    if (!contractAddress) {
      return null;
    }
    const provider = new JsonRpcProvider(rpcUrl);
    return new Contract(contractAddress, contractJson.abi, provider);
  }, [contractAddress, rpcUrl]);

  const refreshData = useCallback(async () => {
    try {
      const contract = await readContract();
      if (!contract) {
        return;
      }
      const [supply, max, state, price] = await Promise.all([
        contract.totalSupply(),
        contract.maxSupply(),
        contract.saleState(),
        contract.price()
      ]);

      setMintCount(supply.toString());
      setMaxSupply(max.toString());
      setSaleStatus(SALE_STATE_LABELS[Number(state)] || "Paused");
      setMintPrice(formatEther(price));
    } catch (error) {
      setTxStatus(`Read error: ${error.message}`);
    }
  }, [readContract]);

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 10000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setTxStatus("MetaMask not found.");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }
      setTxStatus("Wallet connected");
    } catch (error) {
      setTxStatus(`Connection failed: ${error.message}`);
    }
  };

  const onMint = async () => {
    if (!window.ethereum || !address || !contractAddress) {
      return;
    }

    try {
      setTxStatus("Transaction pending...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddress, contractJson.abi, signer);
      const value = parseEther((Number(mintPrice) * quantity).toFixed(18));

      let tx;
      if (saleStatus === "Allowlist") {
        const leaf = hashAddress(address);
        const proof = allowlistTree.getHexProof(leaf);
        tx = await contract.allowlistMint(proof, quantity, { value });
      } else {
        tx = await contract.publicMint(quantity, { value });
      }

      await tx.wait();
      setTxStatus("Mint successful");
      await refreshData();
    } catch (error) {
      setTxStatus(`Mint failed: ${error.shortMessage || error.message}`);
    }
  };

  const isSoldOut = Number(mintCount) >= Number(maxSupply);
  const isConnected = Boolean(address);
  const mintDisabled = !isConnected || saleStatus === "Paused" || isSoldOut || !contractAddress;

  return (
    <main>
      <h1>Generative NFT Collection Launchpad</h1>

      <div className="card">
        {!isConnected && (
          <button data-testid="connect-wallet-button" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
        {isConnected && (
          <p data-testid="connected-address">{address}</p>
        )}
      </div>

      <div className="card">
        <p>
          Minted: <span data-testid="mint-count">{mintCount}</span>
        </p>
        <p>
          Total Supply: <span data-testid="total-supply">{maxSupply}</span>
        </p>
        <p>
          Sale Status: <span data-testid="sale-status">{saleStatus}</span>
        </p>
        <p>Price per NFT: {mintPrice} ETH</p>
      </div>

      <div className="card">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          data-testid="quantity-input"
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value) || 1)}
        />
        <div style={{ marginTop: "1rem" }}>
          <button data-testid="mint-button" disabled={mintDisabled} onClick={onMint}>
            Mint
          </button>
        </div>
        <p>{txStatus}</p>
      </div>
    </main>
  );
}
