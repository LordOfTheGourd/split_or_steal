import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { TOKEN_PROGRAM_ID, AuthorityType } from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
import * as fs from "fs";
import { assert } from "chai";
import { SplitOrSteal } from "../target/types/split_or_steal";
import { PublicKey } from "../tests/split_or_steal";
const SplitOrStealIDL: SplitOrSteal = require("../target/idl/split_or_steal.json");

function loadKeypairFromFile(filePath: string): anchor.web3.Keypair {
  const secretKeyString = fs.readFileSync(filePath, "utf-8");
  const secretKeyArray = JSON.parse(secretKeyString) as number[];
  const secretKey = Uint8Array.from(secretKeyArray);
  return Keypair.fromSecretKey(secretKey);
}

async function createNewMint(
  provider,
  decimals,
  mintAuthority,
  freezeAuthority
) {
  const mint = loadKeypairFromFile(
    "./keypairs/SoRSy2b5sbpCXzWSB999nQFzsgVxUBaymwpNu55Y7WY.json"
  );
  try {
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: mint.publicKey,
          space: token.MintLayout.span,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(
            token.MintLayout.span
          ),
          programId: token.TOKEN_PROGRAM_ID,
        }),
        token.createInitializeMintInstruction(
          mint.publicKey,
          decimals,
          mintAuthority,
          freezeAuthority,
          token.TOKEN_PROGRAM_ID
        )
      ),
      [mint]
    );
  } catch (e) {
    console.log("error", e);
    console.log("that's ok, the mint is already created");
  }
  return mint.publicKey;
}

async function revokeMintAndFreezeAuthorities(
  provider,
  mint,
  currentAuthority
) {
  const tx = new anchor.web3.Transaction().add(
    token.createSetAuthorityInstruction(
      mint,
      currentAuthority,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID
    ),
    token.createSetAuthorityInstruction(
      mint,
      currentAuthority,
      AuthorityType.FreezeAccount,
      null,
      [],
      TOKEN_PROGRAM_ID
    )
  );
  await provider.sendAndConfirm(tx, [], { commitment: "confirmed" });
}

async function main() {
  const connection = new anchor.web3.Connection("...", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );
  anchor.setProvider(provider);

  const programId = new PublicKey(
    "SRSPsMqHaSLJjPNKEoQbTeF6TSvospw2PXGkfj4VzhD"
  );
  const splitOrSteal = new anchor.Program(SplitOrStealIDL, programId, provider);

  const payer = wallet.payer;

  // Create a new mint using the helper function
  const TOKEN_MINT = await createNewMint(
    provider,
    9,
    payer.publicKey,
    payer.publicKey
  );
  console.log("here either?");

  const num_tokens = 1_000_000_000; // 1 billion tokens
  const nine_decimals = 1_000_000_000;
  const tokenAmount = new BN(num_tokens).mul(new BN(nine_decimals));
  console.log("ere?");

  const [gameVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("lord of the gourd")],
    programId
  );
  const [gameVaultTokenAccountPDA] = PublicKey.findProgramAddressSync(
    [gameVaultPDA.toBuffer()],
    programId
  );

  let creatorTokenAccount: PublicKey;

  try {
    console.log("create account");
    // console.log(payer);
    console.log(payer.publicKey);
    console.log(TOKEN_MINT);
    // console.log(provider.connection);
    const randomTokenAccount = new Keypair();
    creatorTokenAccount = await token.createAccount(
      provider.connection,
      payer,
      TOKEN_MINT,
      payer.publicKey,
      randomTokenAccount
    );
    console.log("TokenAccount", creatorTokenAccount);
    // console.log(randomTokenAccount.publicKey);
    // return;

    console.log("mint to ");
    await token.mintTo(
      provider.connection,
      payer,
      TOKEN_MINT,
      creatorTokenAccount,
      payer,
      BigInt(num_tokens) * BigInt(nine_decimals)
    );

    // Revoke mint and freeze authorities
    console.log("revoke mint");
    await revokeMintAndFreezeAuthorities(provider, TOKEN_MINT, payer.publicKey);
  } catch (e) {
    console.log("it's ok it failed", e);
  }

  console.log({
    creator: payer.publicKey.toBase58(),
    creatorTokenAccount: creatorTokenAccount.toBase58(),
    gameVault: gameVaultPDA.toBase58(),
    gameVaultTokenAccount: gameVaultTokenAccountPDA.toBase58(),
    mint: TOKEN_MINT.toBase58(),
    tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
    systemProgram: SystemProgram.programId.toBase58(),
  });

  try {
    const txSignature = await splitOrSteal.methods
      .initializeVault(tokenAmount)
      .accounts({
        creator: payer.publicKey,
        creatorTokenAccount: creatorTokenAccount,
        gameVault: gameVaultPDA,
        gameVaultTokenAccount: gameVaultTokenAccountPDA,
        mint: TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    console.log(tx?.meta?.logMessages);
  } catch (e) {
    console.log("Already init probably");
    console.log(e);
  }

  console.log("done, i doubt it");

  const gameVaultAccount = await splitOrSteal.account.gameVault.fetch(
    gameVaultPDA
  );
  console.log(gameVaultAccount);
  assert.equal(
    gameVaultAccount.mintRemaining.toNumber(),
    tokenAmount.toNumber()
  );
  assert.equal(gameVaultAccount.creator.toBase58(), payer.publicKey.toBase58());

  const mintAccount = await token.getMint(provider.connection, TOKEN_MINT);
  assert(mintAccount.mintAuthority === null);
  assert(mintAccount.freezeAuthority === null);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
