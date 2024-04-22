import { SqsCommand, type IFailedRequest, type ISuccessfulRequest } from "./sqsCommand";
import { EmptyBatchRequest, TooManyEntriesInBatchRequest, BatchEntryIdsNotDistinct, MissingParameterException, throwOnNoPrimitiveType } from "../common/errors";
import { findDuplicatedIds, isJsObject, validateBatchEntryId } from "../common/utils";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class DeleteMessageBatch extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const Failed: IFailedRequest[] = [];
    const Successful: ISuccessfulRequest[] = [];

    for (let i = 0; i < this.body.Entries.length; i++) {
      const entry = this.body.Entries[i];

      if (!("ReceiptHandle" in entry) || typeof entry.ReceiptHandle != "string" || !entry.ReceiptHandle.trim().length) {
        Failed.push({
          Code: "MissingParameter",
          Id: entry.Id,
          Message: `The request must contain the parameter ReceiptHandle.`,
          SenderFault: true,
        });

        continue;
      }

      try {
        if (this.foundQueue!.delete(entry.ReceiptHandle)) {
          Successful.push({ Id: entry.Id });
        } else {
          Failed.push({
            Code: "ReceiptHandleIsInvalid",
            Id: entry.Id,
            Message: `The input receipt handle "${entry.ReceiptHandle}" is not a valid receipt handle.`,
            SenderFault: true,
          });
        }
      } catch (error: any) {
        Failed.push({
          Code: error.Code,
          Id: entry.Id,
          Message: error.message,
          SenderFault: true,
        });
      }
    }

    this.res.end(this.#createResponse(Failed, Successful));
  }

  #setBody() {
    this.body = this.isJsonProtocol ? this.reqBody : this.#parseAmzQueryBody();

    const { Entries } = this.body;

    if (!Entries) {
      const param = this.isJsonProtocol ? "Entries" : "DeleteMessageBatchRequestEntry";
      throw new MissingParameterException(`The request must contain the parameter ${param}.`); // TODO create an issue at AWS SQS support as it produces Internal Server Error
    }

    if (!Array.isArray(Entries) || !Entries.length) {
      throw new EmptyBatchRequest("DeleteMessageBatchRequestEntry");
    }
    if (Entries.length > 10) {
      throw new TooManyEntriesInBatchRequest(Entries.length);
    }

    const values = Object.values(Entries);
    for (let i = 0; i < values.length; i++) {
      const entry = values[i];

      if (!isJsObject(entry) || !("Id" in entry) || entry.Id === null) {
        throw new MissingParameterException(`The request must contain the parameter DeleteMessageBatchRequestEntry.${i + 1}.Id.`);
      }

      throwOnNoPrimitiveType(entry.Id);
      validateBatchEntryId(entry, i, "DeleteMessageBatchRequestEntry");
      throwOnNoPrimitiveType(entry.ReceiptHandle);
    }

    const foundDuplicatedId = findDuplicatedIds(Entries);

    if (foundDuplicatedId) {
      throw new BatchEntryIdsNotDistinct(foundDuplicatedId);
    }
  }
  #parseAmzQueryBody() {
    const body: any = {};

    if (Array.isArray(this.reqBody.DeleteMessageBatchRequestEntry)) {
      body.Entries = this.reqBody.DeleteMessageBatchRequestEntry;
    }

    return body;
  }

  #createResponse(Failed: IFailedRequest[], Successful: ISuccessfulRequest[]) {
    if (this.isJsonProtocol) {
      return JSON.stringify({
        Failed: Failed.length ? Failed : undefined,
        Successful: Successful.length ? Successful : undefined,
      });
    }

    const succeed = Successful.map(
      (x) => `<DeleteMessageBatchResultEntry>
<Id>${x.Id}</Id>
</DeleteMessageBatchResultEntry>`
    ).join("\n");

    const fails = Failed.map(
      (x) => `<BatchResultErrorEntry>
    <Id>${x.Id}</Id>
    <Code>${x.Code}</Code>
    <Message>${x.Message.replace(/"/g, "&quot;")}</Message>
    <SenderFault>true</SenderFault>
</BatchResultErrorEntry>`
    ).join("\n");

    const body = `${xmlVersion}
  <DeleteMessageBatchResponse ${xmlns}>
      <DeleteMessageBatchResult>
        ${succeed}
        ${fails}
      </DeleteMessageBatchResult>
      ${ResponseMetadata(this.RequestId)}
  </DeleteMessageBatchResponse>`;

    return body;
  }
}
