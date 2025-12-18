import { isJsObject } from "./utils";

interface IGeneric {
  RequestId: string;
  Code?: string;
  Message: string;
  SenderFault?: boolean;
}

export class SqsError extends Error {
  Code: string;
  SenderFault: boolean = true;
  Type?: string;
  statusCode?: number;
  constructor({ Code, Message, SenderFault, Type, statusCode }: { Code: string; Message: string; Type?: string; SenderFault?: boolean; statusCode?: number }) {
    super(Message);
    this.Code = Code;
    this.Type = Type;
    this.statusCode = statusCode;
    if (typeof SenderFault == "boolean") {
      this.SenderFault = SenderFault;
    }
  }

  toXml(RequestId: string) {
    return SqsError.genericErrorResponse(
      {
        RequestId,
        Code: this.Code,
        Message: this.message,
        SenderFault: this.SenderFault,
      },
      false
    );
  }
  toJSON() {
    return JSON.stringify({ __type: this.Type, message: this.message });
  }
  getJsonErrorCode() {
    let jsonErrorCode = this.Code;

    if (this.SenderFault) {
      jsonErrorCode += `;Sender`;
    }
    return jsonErrorCode;
  }
  static genericErrorResponse({ RequestId, Code, Message, SenderFault }: IGeneric, isJsonProtocol: boolean) {
    if (isJsonProtocol) {
      return JSON.stringify({ __type: Code, message: Message });
    }

    return `<?xml version="1.0"?>
    <ErrorResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">
        <Error>
            <Type>${SenderFault ? "Sender" : "Server"}</Type>
            <Code>${Code ?? "UnknownOperation"}</Code>
            <Message>${Message}</Message>
            <Detail/>
        </Error>
        <RequestId>${RequestId}</RequestId>
    </ErrorResponse>`;
  }
}

export class InvalidParameterValueException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazon.coral.service#InvalidParameterValueException", Code: "InvalidParameterValue", Message });
  }
}

export class InvalidAttributeNameException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazon.coral.service#InvalidAttributeName", Code: "InvalidAttributeName", Message });
  }
}
export class QueueNameExistsException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazonaws.sqs#QueueNameExists", Code: "QueueAlreadyExists", Message });
  }
}
export class MissingParameterException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazon.coral.service#MissingRequiredParameterException", Code: "MissingParameter", Message });
  }
}

export class MalformedInputException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazon.coral.service#SerializationException", Code: "MalformedInput", Message });
  }
}

export class TooManyEntriesInBatchRequest extends SqsError {
  constructor(entryLenght: number) {
    super({
      Code: "AWS.SimpleQueueService.TooManyEntriesInBatchRequest",
      Type: "com.amazonaws.sqs#TooManyEntriesInBatchRequest",
      Message: `Maximum number of entries per request are 10. You have sent ${entryLenght}.`,
    });
  }
}

export class OverLimitException extends SqsError {
  constructor(Message: string) {
    super({
      Code: "OverLimit",
      Type: "com.amazonaws.sqs#OverLimit",
      Message,
    });
  }
}

export class EmptyBatchRequest extends SqsError {
  constructor(cmd: "DeleteMessageBatchRequestEntry" | "SendMessageBatchRequestEntry" | "ChangeMessageVisibilityBatch") {
    super({
      Code: "AWS.SimpleQueueService.EmptyBatchRequest",
      Type: "com.amazonaws.sqs#EmptyBatchRequest",
      Message: `There should be at least one ${cmd} in the request.`,
    });
  }
}

export class BatchEntryIdsNotDistinct extends SqsError {
  constructor(repetedId: string) {
    super({
      Code: "AWS.SimpleQueueService.BatchEntryIdsNotDistinct",
      Type: "com.amazonaws.sqs#BatchEntryIdsNotDistinct",
      Message: `Id ${repetedId} repeated.`,
    });
  }
}

export class BatchRequestTooLong extends SqsError {
  constructor(totalSize: number) {
    super({
      Type: "com.amazonaws.sqs#BatchRequestTooLong",
      Code: "AWS.SimpleQueueService.BatchRequestTooLong",
      Message: `Batch requests cannot be longer than 1048576 bytes. You have sent ${totalSize} bytes.`,
    });
  }
}
export class UnsupportedOperation extends SqsError {
  constructor(Message: string) {
    super({
      Code: "AWS.SimpleQueueService.UnsupportedOperation",
      Type: "com.amazonaws.sqs#UnsupportedOperation",
      Message,
    });
  }
}

export class PurgeQueueInProgress extends SqsError {
  constructor(QueueName: string) {
    super({
      Type: "com.amazonaws.sqs#PurgeQueueInProgress",
      Code: "AWS.SimpleQueueService.PurgeQueueInProgress",
      Message: `Only one PurgeQueue operation on ${QueueName} is allowed every 60 seconds.`,
      statusCode: 403,
    });
  }
}
export class ResourceNotFoundException extends SqsError {
  constructor(Message: string) {
    super({ Type: "com.amazonaws.sqs#ResourceNotFoundException", Code: "ResourceNotFoundException", statusCode: 404, Message });
  }
}

export const QueueDeletedRecentlyException = new SqsError({
  Code: "AWS.SimpleQueueService.QueueDeletedRecently",
  Type: "com.amazonaws.sqs#QueueDeletedRecently",
  Message: "You must wait 60 seconds after deleting a queue before you can create another with the same name.",
});

export class ReceiptHandleIsInvalidException extends SqsError {
  constructor(ReceiptHandle: string) {
    super({
      Type: "com.amazonaws.sqs#ReceiptHandleIsInvalid",
      Code: "ReceiptHandleIsInvalid",
      Message: `The input receipt handle "${ReceiptHandle}" is not valid.`,
    });
  }
}

export const InvalidKmsDataKeyReusePeriodSeconds = new InvalidParameterValueException("Invalid value for the parameter KmsDataKeyReusePeriodSeconds.");
export const InvalidMessageRetentionPeriod = new InvalidParameterValueException("Invalid value for the parameter MessageRetentionPeriod.");
export const InvalidDelaySeconds = new InvalidParameterValueException("Invalid value for the parameter DelaySeconds.");
export const InvalidReceiveMessageWaitTimeSeconds = new InvalidParameterValueException("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
export const InvalidVisibilityTimeout = new InvalidParameterValueException("Invalid value for the parameter VisibilityTimeout.");
export const InvalidMaximumMessageSize = new InvalidParameterValueException("Invalid value for the parameter MaximumMessageSize.");

export class InvalidMaxNumberOfMessages extends InvalidParameterValueException {
  constructor(rawValue: string) {
    super(`Value ${rawValue} for parameter MaxNumberOfMessages is invalid. Reason: Must be between 1 and 10, if provided.`);
  }
}

export class InvalidArnException extends InvalidParameterValueException {
  constructor(arn: "SourceArn" | "DestinationArn") {
    super(`You must use this format to specify the ${arn}: arn:<partition>:<service>:<region>:<account-id>:<resource-id>`);
  }
}

export const UnexcpectedList = new MalformedInputException("Start of list found where not expected");
export const UnexcpectedObject = new MalformedInputException("Start of structure or map found where not expected.");

export const InvalidBatchEntryId = new SqsError({
  Code: "AWS.SimpleQueueService.InvalidBatchEntryId",
  Type: "com.amazonaws.sqs#InvalidBatchEntryId",
  Message: "A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.",
});

export const throwOnNoPrimitiveType = (param: any) => {
  if (isJsObject(param)) {
    throw UnexcpectedObject;
  }

  if (Array.isArray(param)) {
    throw UnexcpectedList;
  }
};

export function notStringSerializationException(value: any) {
  if (Array.isArray(value)) {
    return new MalformedInputException("Start of list found where not expected");
  }

  if (typeof value == "object") {
    return new MalformedInputException("Start of structure or map found where not expected.");
  }

  if (typeof value == "boolean") {
    return new MalformedInputException(`${String(value).toUpperCase()}_VALUE can not be converted to a String`);
  }

  if (typeof value == "number") {
    return new MalformedInputException("NUMBER_VALUE can not be converted to a String");
  }

  return new MalformedInputException(`Invalid value: ${typeof value} ${value}`);
}
