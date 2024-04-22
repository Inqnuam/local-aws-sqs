import { SqsCommand, type IFailedRequest, type ISuccessfulRequest } from "./sqsCommand";
import { BatchEntryIdsNotDistinct, EmptyBatchRequest, MissingParameterException, TooManyEntriesInBatchRequest, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import { findDuplicatedIds, verifyQueueAttribValue, isJsObject, validateBatchEntryId } from "../common/utils";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class ChangeMessageVisibilityBatch extends SqsCommand {
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

      if (!("VisibilityTimeout" in entry)) {
        Failed.push({
          Code: "MissingParameter",
          Id: entry.Id,
          Message: `The request must contain the parameter ChangeMessageVisibilityBatchRequestEntry.${i + 1}.VisibilityTimeout.`,
          SenderFault: true,
        });

        continue;
      } else {
        const errMsg = verifyQueueAttribValue.VisibilityTimeout(entry.VisibilityTimeout);

        if (errMsg) {
          Failed.push({
            Code: "InvalidParameterValue",
            Id: entry.Id,
            Message: `Value ${entry.VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.`,
            SenderFault: true,
          });
          continue;
        }
      }

      try {
        if (this.foundQueue!.changeVisibility(entry.ReceiptHandle, entry.VisibilityTimeout)) {
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
      const param = this.isJsonProtocol ? "Entries" : "ChangeMessageVisibilityBatchRequestEntry";
      throw new MissingParameterException(`The request must contain the parameter ${param}.`); // NOTE create an issue at AWS SQS support
    }

    if (!Array.isArray(Entries) || !Entries.length) {
      throw new EmptyBatchRequest("ChangeMessageVisibilityBatch");
    }
    if (Entries.length > 10) {
      throw new TooManyEntriesInBatchRequest(Entries.length);
    }

    const values = Object.values(Entries);
    for (let i = 0; i < values.length; i++) {
      const entry = values[i];

      if (!isJsObject(entry) || !("Id" in entry) || entry.Id === null) {
        throw new MissingParameterException(`The request must contain the parameter ChangeMessageVisibilityBatch.${i + 1}.Id.`);
      }

      if (Array.isArray(entry.Id)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.Id)) {
        throw UnexcpectedObject;
      }
      validateBatchEntryId(entry, i, "ChangeMessageVisibilityBatch");

      if (Array.isArray(entry.ReceiptHandle)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.ReceiptHandle)) {
        throw UnexcpectedObject;
      }

      if (Array.isArray(entry.VisibilityTimeout)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.VisibilityTimeout)) {
        throw UnexcpectedObject;
      }
    }

    const foundDuplicatedId = findDuplicatedIds(Entries);

    if (foundDuplicatedId) {
      throw new BatchEntryIdsNotDistinct(foundDuplicatedId);
    }
  }

  #parseAmzQueryBody() {
    const body: any = {};

    if (Array.isArray(this.reqBody.ChangeMessageVisibilityBatchRequestEntry)) {
      body.Entries = this.reqBody.ChangeMessageVisibilityBatchRequestEntry;
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

    let succeed = Successful.map(
      (x) => `<ChangeMessageVisibilityBatchResultEntry>
<Id>${x.Id}</Id>
</ChangeMessageVisibilityBatchResultEntry>`
    ).join("\n");

    let fails = Failed.map(
      (x) => `<BatchResultErrorEntry>
    <Id>${x.Id}</Id>
    <Code>${x.Code}</Code>
    <Message>${x.Message.replace(/"/g, "&quot;")}</Message>
    <SenderFault>true</SenderFault>
</BatchResultErrorEntry>`
    ).join("\n");

    const body = `${xmlVersion}<ChangeMessageVisibilityBatchResponse ${xmlns}>
    <ChangeMessageVisibilityBatchResult>
        ${succeed}
        ${fails}
    </ChangeMessageVisibilityBatchResult>
    ${ResponseMetadata(this.RequestId)}
</ChangeMessageVisibilityBatchResponse>`;

    return body;
  }
}
