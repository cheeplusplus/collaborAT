import {
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoDeleteRecord,
  ComAtprotoRepoPutRecord,
} from "@atproto/api";
import { RepoOperationSource } from "../scoping/scopes";

export interface RecordRequestDetails {
  operationSource: RepoOperationSource;
  repo: string;
  collection: string;
  rkey?: string;
  record?: any; // we may not want to store the original record but keep it now for testing
}
export interface RecordResponseDetails {
  uri?: string;
  cid?: string;
}
export interface RecordDetails
  extends RecordRequestDetails,
    RecordResponseDetails {}

export function extractRecordDetailsFromRequest(
  xrpcName: string,
  requestBody: any,
): RecordRequestDetails[] | undefined {
  if (!requestBody) {
    return undefined;
  }

  if (xrpcName === "com.atproto.repo.applyWrites") {
    const reqBody = requestBody as ComAtprotoRepoApplyWrites.InputSchema;
    return reqBody.writes.map((m) => ({
      operationSource: m.$type,
      repo: reqBody.repo,
      collection: m.collection,
      rkey: m.rkey,
      record: "value" in m ? m.value : undefined,
    }));
  }

  if (xrpcName === "com.atproto.repo.createRecord") {
    const reqBody = requestBody as ComAtprotoRepoCreateRecord.InputSchema;
    return [
      {
        operationSource: xrpcName,
        repo: reqBody.repo,
        collection: reqBody.collection,
        rkey: reqBody.rkey,
        record: reqBody.record,
      },
    ];
  }

  if (xrpcName === "com.atproto.repo.deleteRecord") {
    const reqBody = requestBody as ComAtprotoRepoDeleteRecord.InputSchema;
    return [
      {
        operationSource: xrpcName,
        repo: reqBody.repo,
        collection: reqBody.collection,
        rkey: reqBody.rkey,
      },
    ];
  }

  if (xrpcName === "com.atproto.repo.putRecord") {
    const reqBody = requestBody as ComAtprotoRepoPutRecord.InputSchema;
    return [
      {
        operationSource: xrpcName,
        repo: reqBody.repo,
        collection: reqBody.collection,
        rkey: reqBody.rkey,
        record: reqBody.record,
      },
    ];
  }

  return undefined;
}

export function extractRecordDetailsFromResponse(
  xrpcName: string,
  responseBody: any,
): RecordResponseDetails[] | undefined {
  if (!responseBody) {
    return undefined;
  }

  if (xrpcName === "com.atproto.repo.applyWrites") {
    const resBody = responseBody as ComAtprotoRepoApplyWrites.OutputSchema;
    return resBody.results?.map((m) => ({
      uri: "uri" in m ? m.uri : undefined,
      cid: "cid" in m ? m.cid : undefined,
    }));
  }

  if (xrpcName === "com.atproto.repo.createRecord") {
    const resBody = responseBody as ComAtprotoRepoCreateRecord.OutputSchema;
    return [
      {
        uri: resBody.uri,
        cid: resBody.cid,
      },
    ];
  }

  if (xrpcName === "com.atproto.repo.deleteRecord") {
    const resBody = responseBody as ComAtprotoRepoDeleteRecord.OutputSchema;
    return [
      {
        cid: resBody.commit?.cid,
      },
    ];
  }

  if (xrpcName === "com.atproto.repo.putRecord") {
    const resBody = responseBody as ComAtprotoRepoPutRecord.OutputSchema;
    return [
      {
        uri: resBody.uri,
        cid: resBody.cid,
      },
    ];
  }

  return undefined;
}
