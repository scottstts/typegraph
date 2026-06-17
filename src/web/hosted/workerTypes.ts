import type { TypeGraphPayload } from "../../shared/graphTypes.js";

export type HostedWorkerRequest = {
  type: "analyze-github";
  requestId: number;
  input: string;
};

export type HostedWorkerProgress = {
  type: "progress";
  requestId: number;
  message: string;
};

export type HostedWorkerSuccess = {
  type: "success";
  requestId: number;
  graph: TypeGraphPayload;
};

export type HostedWorkerFailure = {
  type: "failure";
  requestId: number;
  message: string;
};

export type HostedWorkerResponse =
  | HostedWorkerProgress
  | HostedWorkerSuccess
  | HostedWorkerFailure;
