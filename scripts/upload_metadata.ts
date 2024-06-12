import * as anchor from "@coral-xyz/anchor";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
const { PublicKey, Keypair, Transaction } = anchor.web3;

// Define metadata program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const connection = new anchor.web3.Connection("...", "confirmed");
const wallet = anchor.Wallet.local();
const provider = new anchor.AnchorProvider(
  connection,
  wallet,
  anchor.AnchorProvider.defaultOptions()
);

// Assuming mint, wallet, and connection are already defined
const mintPublicKey = new PublicKey(
  "SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY"
);

// Get metadata PDA
const getMetadataPDA = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),
    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
    mintPublicKey.toBuffer(),
  ],
  TOKEN_METADATA_PROGRAM_ID
);

const metadataPDA = getMetadataPDA[0];

// Create metadata instruction
const metadata = {
  name: "Split or Steal",
  symbol: "SORS",
  uri: "https://bafybeibscf4nobkyhgkzwyl7pcfeozxackrmupvgdut5ef3y4unae5yray.ipfs.nftstorage.link",
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
};

const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
  {
    metadata: metadataPDA,
    mint: mintPublicKey,
    mintAuthority: wallet.publicKey!,
    payer: wallet.publicKey!,
    updateAuthority: wallet.publicKey!,
  },
  {
    createMetadataAccountArgsV3: {
      collectionDetails: null,
      data: metadata,
      isMutable: false, // Change to false if you want to make it immutable
    },
  }
);

// Add compute budget program instructions
const computeBudgetInstruction = [
  anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
  anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 20_000,
  }),
];

// Add metadata instruction to the transaction
const tx = new Transaction().add(
  ...computeBudgetInstruction,
  createMetadataInstruction
);

async function notTopLevelSend(tx) {
  await provider.sendAndConfirm(tx, [], { skipPreflight: true });
  console.log("Metadata added:", metadataPDA.toBase58());
}

notTopLevelSend(tx);
// Add recent blockhash and fee payer
// const blockhash = (await connection.getLatestBlockhash()).blockhash;
// tx.recentBlockhash = blockhash;
// tx.feePayer = wallet.publicKey!;

// Sign and send transaction
// const signedTx = tx;
