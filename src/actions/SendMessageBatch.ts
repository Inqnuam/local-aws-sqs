import { SqsCommand } from "./sqsCommand";
import { EmptyBatchRequest, InvalidParameterValueException, MissingParameterException, TooManyEntriesInBatchRequest, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import { verifySendMessageBatch } from "../validators/verifyRequest";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { isJsObject, validateBatchEntryId } from "../common/utils";
import { verifyStandartQueueBatchMsgEntry } from "../validators/verifyStandartQueueBatchMsgEntry";
import { verifyAttributeValueStructure } from "../validators/verifyAttributeValueStructure";

export class SendMessageBatch extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();
    const { Entries } = this.body;

    verifySendMessageBatch(Entries, this.foundQueue!);

    const success: any[] = [];
    const failures: any[] = [];

    Entries.forEach((msg: any, i: number) => {
      if (!this.foundQueue!.FifoQueue) {
        const err = verifyStandartQueueBatchMsgEntry(msg, i, this.foundQueue!);

        if (err) {
          failures.push(err);
          return;
        }
      }

      try {
        const { record, MD5OfMessageSystemAttributes } = this.foundQueue!.setRecord(msg);

        let result: any = {
          Id: msg.Id,
          MessageId: record.MessageId,
          MD5OfMessageBody: record.MD5OfMessageBody,
        };
        if (record.attributes.SequenceNumber) {
          result.SequenceNumber = record.attributes.SequenceNumber;
        }

        if (record.MD5OfMessageAttributes) {
          result.MD5OfMessageAttributes = record.MD5OfMessageAttributes;
        }
        if (MD5OfMessageSystemAttributes) {
          result.MD5OfMessageSystemAttributes = MD5OfMessageSystemAttributes;
        }

        success.push(result);
      } catch (error: any) {
        let result: any = {
          Id: msg.Id,
          Message: error.message,
        };

        if (error.Code) {
          result.Code = error.Code;
        }

        if ("SenderFault" in error) {
          result.SenderFault = `${error.SenderFault}`;
        }

        failures.push(result);
      }
    });

    this.res.end(this.#createResponse(success, failures));
  }

  #setBody() {
    this.body = this.isJsonProtocol ? this.reqBody : this.#parseAmzQueryBody();

    const { Entries } = this.body;

    if (!Entries) {
      const param = this.isJsonProtocol ? "Entries" : "SendMessageBatchRequestEntry";
      throw new MissingParameterException(`The request must contain the parameter ${param}.`); // NOTE create an issue at AWS SQS support
    }

    if (!Array.isArray(Entries) || !Entries.length) {
      throw new EmptyBatchRequest("SendMessageBatchRequestEntry");
    }
    if (Entries.length > 10) {
      throw new TooManyEntriesInBatchRequest(Entries.length);
    }

    const values = Object.values(Entries);
    for (let i = 0; i < values.length; i++) {
      const entry = values[i];

      if (!isJsObject(entry) || !("Id" in entry) || entry.Id === null) {
        throw new MissingParameterException(`The request must contain the parameter SendMessageBatchRequestEntry.${i + 1}.Id.`);
      }

      if (Array.isArray(entry.Id)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.Id)) {
        throw UnexcpectedObject;
      }
      validateBatchEntryId(entry, i, "SendMessageBatchRequestEntry");

      if (Array.isArray(entry.MessageBody)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.MessageBody)) {
        throw UnexcpectedObject;
      }

      if (Array.isArray(entry.DelaySeconds)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.DelaySeconds)) {
        throw UnexcpectedObject;
      }

      if (Array.isArray(entry.MessageDeduplicationId)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.MessageDeduplicationId)) {
        throw UnexcpectedObject;
      }

      if (Array.isArray(entry.MessageGroupId)) {
        throw UnexcpectedList;
      }

      if (isJsObject(entry.MessageGroupId)) {
        throw UnexcpectedObject;
      }

      if (isJsObject(entry.MessageAttributes)) {
        verifyMessageAttributeValuesStructure(entry.MessageAttributes);
      }

      if (isJsObject(entry.MessageSystemAttributes)) {
        verifyMessageAttributeValuesStructure(entry.MessageSystemAttributes);
      }
    }
  }
  #parseAmzQueryBody() {
    const body: any = {};
    if (Array.isArray(this.reqBody.SendMessageBatchRequestEntry)) {
      body.Entries = [];

      for (const x of this.reqBody.SendMessageBatchRequestEntry) {
        let entry: any = {};

        if ("Id" in x) {
          entry.Id = x.Id;
        }
        if ("MessageBody" in x) {
          entry.MessageBody = x.MessageBody;
        }

        if ("MessageGroupId" in x) {
          entry.MessageGroupId = x.MessageGroupId;
        }
        if ("MessageDeduplicationId" in x) {
          entry.MessageDeduplicationId = x.MessageDeduplicationId;
        }

        if ("MessageAttribute" in x) {
          if (!Array.isArray(x.MessageAttribute)) {
            throw new InvalidParameterValueException("Invalid MessageAttribute value");
          }
          entry.MessageAttributes = {};

          for (const attr of x.MessageAttribute) {
            if (!isJsObject(attr)) {
              throw new InvalidParameterValueException("Invalid MessageAttribute batch value");
            }

            if (!("Name" in attr)) {
              throw new MissingParameterException("MessageAttribute must include 'Name' parameter");
            }

            if (!("Value" in attr)) {
              throw new MissingParameterException("MessageAttribute must include 'Value' parameter");
            }

            entry.MessageAttributes[attr.Name] = attr.Value;
          }
        }
        if ("MessageSystemAttribute" in x) {
          if (!Array.isArray(x.MessageSystemAttribute)) {
            throw new InvalidParameterValueException("Invalid MessageSystemAttribute value");
          }

          entry.MessageSystemAttributes = {};

          for (const attr of x.MessageSystemAttribute) {
            if (!isJsObject(attr)) {
              throw new InvalidParameterValueException("Invalid MessageSystemAttribute batch value");
            }

            if (!("Name" in attr)) {
              throw new MissingParameterException("MessageSystemAttributes must include 'Name' parameter");
            }

            if (!("Value" in attr)) {
              throw new MissingParameterException("MessageSystemAttributes must include 'Value' parameter");
            }

            entry.MessageSystemAttributes[attr.Name] = attr.Value;
          }
        }

        body.Entries.push(entry);
      }
    }

    return body;
  }

  #createResponse(success: any[], failures: any[]) {
    if (this.isJsonProtocol) {
      return JSON.stringify({
        Successful: success.length ? success : undefined,
        Failed: failures.length
          ? failures.map(({ Code, Id, Message, SenderFault }) => {
              return {
                Code,
                Id,
                Message,
                SenderFault: SenderFault == "true",
              };
            })
          : undefined,
      });
    }

    let SendMessageBatchResult = "";

    success.forEach((record) => {
      SendMessageBatchResult += "<SendMessageBatchResultEntry>\n";

      Object.entries(record).forEach((x) => {
        const [k, v] = x;

        SendMessageBatchResult += `<${k}>${v}</${k}>\n`;
      });

      SendMessageBatchResult += `</SendMessageBatchResultEntry>\n`;
    });

    failures.forEach((record) => {
      SendMessageBatchResult += "<BatchResultErrorEntry>\n";

      Object.entries(record).forEach((x) => {
        const [k, v] = x;

        SendMessageBatchResult += `<${k}>${v}</${k}>\n`;
      });

      SendMessageBatchResult += `</BatchResultErrorEntry>\n`;
    });

    const body = `${xmlVersion}<SendMessageBatchResponse ${xmlns}>
        <SendMessageBatchResult>
            ${SendMessageBatchResult}
        </SendMessageBatchResult>
        ${ResponseMetadata(this.RequestId)}
        </SendMessageBatchResponse>`;
    return body;
  }
}

const verifyMessageAttributeValuesStructure = (MessageAttributes: Record<string, any>) => {
  const values = Object.values(MessageAttributes);

  for (const v of values) {
    verifyAttributeValueStructure(v);
  }
};
