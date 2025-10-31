import { PublicKey, VersionedTransaction } from "@solana/web3.js";
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

export interface SwapEvent {
  inputMint: string;
  inputAmount: string;
  outputMint: string;
  outputAmount: string;
}

export interface ExecuteOrderSuccessResponse {
  status: "Success";
  signature: string;
  slot: string;
  code: number;
  inputAmountResult: string;
  outputAmountResult: string;
  swapEvents: SwapEvent[];
}

export interface ExecuteOrderErrorResponse {
  status: "Failed";
  signature: string;
  error: string;
  code: number;
  slot: string;
}

export type ExecuteOrderResponse =
  | ExecuteOrderSuccessResponse
  | ExecuteOrderErrorResponse;

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

  static async executeOrder(args: {
    requestId: string;
    signedTransaction: VersionedTransaction;
  }) {
    const { requestId, signedTransaction } = args;
    const { data } = await this.client.post<ExecuteOrderResponse>("execute", {
      requestId,
      signedTransaction: Buffer.from(signedTransaction.serialize()).toString(
        "base64",
      ),
    });
    return data;
  }
}
