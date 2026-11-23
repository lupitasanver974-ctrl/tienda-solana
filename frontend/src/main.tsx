import { Buffer } from "buffer";
(window as any).Buffer = Buffer;
import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import App from "./App";

function Root() {
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={clusterApiUrl("devnet")}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider><App /></WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);
