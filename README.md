# Generative NFT Collection Launchpad (Merkle Allowlist)

A full-stack NFT launchpad implementing:

- ERC-721 NFT minting
- ERC-2981 royalties
- Merkle tree allowlist minting
- Reveal mechanism with unrevealed/revealed metadata URIs
- Next.js frontend DApp with wallet connect and mint flow
- Hardhat tests and deployment scripts
- Dockerized local environment (Hardhat node + frontend)

## Project Structure

```
contracts/            Solidity smart contracts
scripts/              Deployment + off-chain scripts (Merkle, IPFS)
test/                 Hardhat unit tests
frontend/             Next.js DApp
Dockerfile            Multi-stage Docker build
docker-compose.yml    Service orchestration
.env.example          Environment variable template
hardhat.config.js     Hardhat configuration
```

## Core Features

### Smart Contract (`contracts/MyNFT.sol`)

- Inherits from OpenZeppelin `ERC721`, `Ownable`, `ERC2981`, and `ReentrancyGuard`
- Sale phases via enum `SaleState { Paused, Allowlist, Public }`
- Allowlist minting with Merkle proof verification
- Public minting for open sale phase
- Owner-only configuration:
  - `setPrice(uint256)`
  - `setBaseURI(string)`
  - `setRevealedURI(string)`
  - `setMerkleRoot(bytes32)`
  - `setSaleState(SaleState)`
- Reveal mechanism:
  - `isRevealed` flag
  - `reveal()` owner-only switch
  - `tokenURI` returns unrevealed or revealed URI accordingly
- Security controls:
  - `pause()` / `unpause(SaleState)`
  - owner-only `withdraw()` using CEI + nonReentrant
- Supply + wallet limits:
  - max supply fixed at `10_000`
  - per-wallet mint tracking

### Scripts (`scripts/`)

- `deploy.js`: deploys `MyNFT` and exports ABI to `frontend/contracts/MyNFT.json`
- `generate-merkle.js`: reads root `allowlist.json`, prints Merkle root
- `upload-ipfs.js`: uploads files in a folder to Pinata and outputs CID

### Frontend (`frontend/`)

- Connect wallet button with `data-testid="connect-wallet-button"`
- Connected address display with `data-testid="connected-address"`
- Mint UI:
  - quantity input `data-testid="quantity-input"`
  - mint button `data-testid="mint-button"`
- On-chain status display:
  - minted count `data-testid="mint-count"`
  - total supply `data-testid="total-supply"`
  - sale state `data-testid="sale-status"`
- Mint routing logic:
  - Allowlist phase: `allowlistMint(proof, quantity)`
  - Public phase: `publicMint(quantity)`
- Periodic on-chain refresh every 10 seconds and post-mint refresh

## Setup

### 1) Install dependencies

```bash
npm install
cd frontend && npm install
```

### 2) Configure environment

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

At minimum for local frontend:

- `NEXT_PUBLIC_CONTRACT_ADDRESS` after deployment
- `NEXT_PUBLIC_RPC_URL` (`http://localhost:8545`)

## Local Run (without Docker)

### Terminal A

```bash
npm run node
```

### Terminal B

```bash
npm run compile
npm run deploy:localhost
```

### Terminal C

```bash
cd frontend
npm run dev
```

Open: `http://localhost:3000`

## Docker Run

```bash
docker-compose up --build
```

Services:

- Hardhat node: `http://localhost:8545`
- Frontend: `http://localhost:3000`

## Testing

Run all smart contract tests:

```bash
npm test
```

Coverage includes:

- ERC721 + ERC2981 interface support
- owner-only access control
- allowlist proof verification and phase checks
- public minting and wallet cap checks
- reveal URI switching behavior
- pause/unpause behavior
- secure withdraw behavior

## Merkle Root Generation

`allowlist.json` (root) should contain an array of addresses.

```bash
npm run generate:merkle
```

Prints a root like:

```text
0xabc123... (32-byte hex)
```

## Deployment (Sepolia)

1. Set `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in `.env`
2. Run:

```bash
npm run compile
npm run deploy:sepolia
```

3. Put deployed address into:

- `.env` as `NEXT_PUBLIC_CONTRACT_ADDRESS`

## Metadata Standard

Example metadata object:

```json
{
  "name": "My NFT #1",
  "description": "A unique generative NFT.",
  "image": "ipfs://CID_OF_IMAGE_FOLDER/1.png",
  "attributes": [
    { "trait_type": "Background", "value": "Blue" },
    { "trait_type": "Eyes", "value": "Laser" }
  ]
}
```

## Notes

- No real secrets are committed.
- `frontend/contracts/MyNFT.json` is present for ABI consumption and is refreshed by deployment script.
- For local browser access when running in Docker, frontend normalizes `http://hardhat-node:8545` to `http://localhost:8545` on the client.