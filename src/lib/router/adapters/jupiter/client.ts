import { PublicKey } from "@solana/web3.js";
import axios, { AxiosInstance } from "axios";
import BN from "bn.js";

export interface GetOrderResponse {
  error: string | null;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  feeMint: string;
  feeBps: number;
  prioritizationFeeLamports: number;
  swapType: "aggregator" | "rfq" | "hashflow";
  transaction: string | null;
  gasless: boolean;
  requestId: string;
  totalTime: number;
  taker: string | null;
  quoteId: string;
  maker: string;
  expireAt: string;
  platformFee: {
    amount: string;
    feeBps: number;
  };
  dynamicSlippageReport: {
    amplificationRatio: string | null;
    otherAmount: number | null;
    simulatedIncurredSlippageBps: number | null;
    slippageBps: number;
    categoryName: string;
    heuristicMaxSlippageBps: number;
  };
}

export default class Jupiter {
  private static client: AxiosInstance = axios.create({
    baseURL: "https://lite-api.jup.ag/ultra/v1",
  });

  static async getOrder(args: {
    inputMint: PublicKey;
    outputMint: PublicKey;
    amount: BN;
    signer: PublicKey;
  }) {
    const { data } = await this.client.get<GetOrderResponse>("order", {
      params: {
        inputMint: args.inputMint.toString(),
        outputMint: args.outputMint.toString(),
        amount: args.amount.toString(),
        taker: args.signer.toString(),
        referralAccount: import.meta.env.VITE_JUPITER_REFERRAL_ACCOUNT!,
        referralFee: 100,
      },
    });
    return data;
  }
}
