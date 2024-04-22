import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { InvalidParameterValueException, MalformedInputException, MissingParameterException, SqsError, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import { isJsObject, verifyQueueAttribValue } from "../common/utils";

export class ChangeMessageVisibility extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const { ReceiptHandle, VisibilityTimeout } = this.body;

    if (this.foundQueue!.changeVisibility(ReceiptHandle, VisibilityTimeout)) {
      return this.res.end(this.#createResponse());
    }

    throw new SqsError({
      Type: "com.amazonaws.sqs#ReceiptHandleIsInvalid",
      Code: "ReceiptHandleIsInvalid",
      Message: `The input receipt handle "${ReceiptHandle}" is not a valid receipt handle.`,
      statusCode: 404,
    });
  }

  #setBody() {
    const body: any = {};

    if (!("ReceiptHandle" in this.reqBody)) {
      throw new MissingParameterException("The request must contain the parameter ReceiptHandle.");
    }

    if (Array.isArray(this.reqBody.ReceiptHandle)) {
      throw UnexcpectedList;
    }

    if (isJsObject(this.reqBody.ReceiptHandle)) {
      throw UnexcpectedObject;
    }

    if (typeof this.reqBody.ReceiptHandle != "string") {
      throw new InvalidParameterValueException("The input receipt handle is invalid.");
    }

    if (this.reqBody.ReceiptHandle.trim() == "") {
      throw new MissingParameterException("The request must contain the parameter ReceiptHandle.");
    }

    body.ReceiptHandle = this.reqBody.ReceiptHandle;

    if (!("VisibilityTimeout" in this.reqBody)) {
      throw new MissingParameterException("The request must contain the parameter VisibilityTimeout.");
    }

    const errMsg = verifyQueueAttribValue.VisibilityTimeout(this.reqBody.VisibilityTimeout);

    if (errMsg instanceof MalformedInputException) {
      if (errMsg.message.startsWith("U")) {
        throw UnexcpectedList;
      }

      throw errMsg;
    }

    if (errMsg) {
      throw new InvalidParameterValueException(`Value ${this.reqBody.VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
    }
    body.VisibilityTimeout = this.reqBody.VisibilityTimeout;

    this.body = body;
  }
  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<ChangeMessageVisibilityResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
      </ChangeMessageVisibilityResponse>`;
  }
}
