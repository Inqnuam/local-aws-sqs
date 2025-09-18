import { SqsCommand } from "./sqsCommand";
import { ALPHANUM_PUNCT_PATTERN } from "../common/constants";
import { MissingParameterException, InvalidParameterValueException, SqsError, MalformedInputException, throwOnNoPrimitiveType } from "../common/errors";
import { sha256, verifyQueueAttribValue } from "../common/utils";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { verifyMessageAttributes } from "../validators/verifyMessageAttributes";
import { verifyAttributeValueStructure } from "../validators/verifyAttributeValueStructure";

export class SendMessage extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.verifySendMessageRequestParams();

    const { record, MD5OfMessageSystemAttributes } = this.foundQueue!.setRecord(this.reqBody);

    this.res.end(this.#createResponse(record, MD5OfMessageSystemAttributes));
  }

  verifySendMessageRequestParams() {
    const msg = this.reqBody;

    if (typeof msg.MessageBody == "number" || typeof msg.MessageBody == "boolean") {
      msg.MessageBody = String(msg.MessageBody);
    }

    if (!msg.MessageBody) {
      // if doesnt exists or is an empty string
      throw new MissingParameterException("The request must contain the parameter MessageBody.");
    }

    throwOnNoPrimitiveType(msg.MessageBody);

    if (this.foundQueue!.FifoQueue) {
      if (!msg.MessageGroupId) {
        throw new MissingParameterException("The request must contain the parameter MessageGroupId.");
      }
      if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageGroupId)) {
        throw new InvalidParameterValueException(
          `Value ${msg.MessageGroupId} for parameter MessageGroupId is invalid. Reason: MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length.`
        );
      }

      if (msg.MessageDeduplicationId) {
        if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageDeduplicationId)) {
          throw new InvalidParameterValueException(
            `Value ${msg.MessageDeduplicationId} for parameter MessageDeduplicationId is invalid. Reason: MessageDeduplicationId can only include alphanumeric and punctuation characters. 1 to 128 in length.`
          );
        }
      } else if (this.foundQueue!.ContentBasedDeduplication) {
        msg.MessageDeduplicationId = sha256(msg.MessageBody);
      } else {
        throw new InvalidParameterValueException("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
      }
    } else {
      if (msg.MessageDeduplicationId) {
        throw new InvalidParameterValueException("The request include parameter MessageDeduplicationId which is not valid for this queue type");
      }

      if ("MessageGroupId" in msg) {
        if (typeof msg.MessageGroupId != "string") {
          throw new InvalidParameterValueException(
            `Value ${msg.MessageGroupId} for parameter MessageGroupId is invalid. Reason: MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length.`
          );
        }

        if (!ALPHANUM_PUNCT_PATTERN.test(msg.MessageGroupId)) {
          throw new InvalidParameterValueException(
            `Value ${msg.MessageGroupId} for parameter MessageGroupId is invalid. Reason: MessageGroupId can only include alphanumeric and punctuation characters. 1 to 128 in length.`
          );
        }
      }
    }

    if ("DelaySeconds" in msg) {
      if (isNaN(msg.DelaySeconds)) {
        throw new SqsError({ Code: "MalformedInput", Type: "com.amazon.coral.service#SerializationException", Message: "STRING_VALUE can not be converted to an Integer" });
      }

      // DelaySeconds is not valid for FIFO Queues
      if (this.foundQueue!.FifoQueue) {
        throw new InvalidParameterValueException(
          `Value ${msg.DelaySeconds} for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.`
        );
      }

      const delayIsInvalid = verifyQueueAttribValue.DelaySeconds(msg.DelaySeconds);
      if (delayIsInvalid) {
        if (delayIsInvalid instanceof MalformedInputException) {
          throw delayIsInvalid;
        }

        throw new InvalidParameterValueException(`Value ${msg.DelaySeconds} for parameter DelaySeconds is invalid. Reason: DelaySeconds must be >= 0 and <= 900.`);
      }
    }

    let MessageAttribute: any;

    if (this.isJsonProtocol) {
      MessageAttribute = msg.MessageAttributes;
    } else if (Array.isArray(msg.MessageAttribute)) {
      let parsedAttribs: any = {};

      for (const att of msg.MessageAttribute) {
        parsedAttribs[att.Name] = att.Value;
      }

      msg.MessageAttributes = parsedAttribs;
      MessageAttribute = msg.MessageAttributes;

      delete msg.MessageAttribute;
    }

    let messageLength = msg.MessageBody.length;

    if (MessageAttribute) {
      const attribValues: any[] = Object.values(MessageAttribute);

      for (const v of attribValues) {
        verifyAttributeValueStructure(v);
        const { StringValue, BinaryValue, DataType } = v;

        if (typeof DataType == "string") {
          messageLength += DataType.length;
        }

        if (typeof StringValue == "string") {
          messageLength += StringValue.length;
        }

        if (typeof BinaryValue == "string") {
          messageLength += BinaryValue.length;
        }
      }

      verifyMessageAttributes(MessageAttribute);

      const keys = Object.keys(MessageAttribute);

      for (const key of keys) {
        messageLength += key.length;
      }
    }

    if (messageLength > this.foundQueue!.MaximumMessageSize) {
      throw new InvalidParameterValueException(`One or more parameters are invalid. Reason: Message must be shorter than ${this.foundQueue!.MaximumMessageSize} bytes.`);
    }

    let MessageSystemAttribute: any;

    if (this.isJsonProtocol) {
      MessageSystemAttribute = msg.MessageSystemAttributes;
    } else if (Array.isArray(msg.MessageSystemAttribute)) {
      let parsedAttribs: any = {};

      for (const att of msg.MessageSystemAttribute) {
        parsedAttribs[att.Name] = att.Value;
      }

      msg.MessageSystemAttributes = parsedAttribs;
      MessageSystemAttribute = msg.MessageSystemAttributes;

      delete msg.MessageSystemAttribute;
    }

    if (MessageSystemAttribute) {
      for (const v of Object.values(MessageSystemAttribute)) {
        verifyAttributeValueStructure(v as any);
      }

      verifyMessageAttributes(MessageSystemAttribute, "system");
    }
  }

  #createResponse(record: any, MD5OfMessageSystemAttributes?: string) {
    if (this.isJsonProtocol) {
      const body: Record<string, any> = { MD5OfMessageBody: record.MD5OfMessageBody, MD5OfMessageAttributes: record.MD5OfMessageAttributes, MessageId: record.MessageId };

      if (record.attributes.SequenceNumber) {
        body.SequenceNumber = record.attributes.SequenceNumber;
      }

      if (MD5OfMessageSystemAttributes) {
        body.MD5OfMessageSystemAttributes = MD5OfMessageSystemAttributes;
      }
      return JSON.stringify(body);
    }

    return this.#xmlResponse(record, MD5OfMessageSystemAttributes);
  }
  #xmlResponse(record: any, MD5OfMessageSystemAttributes?: string) {
    let SendMessageResult = `<MD5OfMessageBody>${record.MD5OfMessageBody}</MD5OfMessageBody>\n`;

    if (record.MD5OfMessageAttributes) {
      SendMessageResult += `<MD5OfMessageAttributes>${record.MD5OfMessageAttributes}</MD5OfMessageAttributes>\n`;
    }

    if (MD5OfMessageSystemAttributes) {
      SendMessageResult += `<MD5OfMessageSystemAttributes>${MD5OfMessageSystemAttributes}</MD5OfMessageSystemAttributes>`;
    }

    SendMessageResult += `<MessageId>${record.MessageId}</MessageId>`;

    if (record.attributes.SequenceNumber) {
      SendMessageResult += `<SequenceNumber>${record.attributes.SequenceNumber}</SequenceNumber>`;
    }

    const body = `${xmlVersion}<SendMessageResponse ${xmlns}>
        <SendMessageResult>
           ${SendMessageResult}
        </SendMessageResult>
        ${ResponseMetadata(this.RequestId)}
    </SendMessageResponse>`;

    return body;
  }
}
