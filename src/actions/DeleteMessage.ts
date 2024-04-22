import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { MissingParameterException, ReceiptHandleIsInvalidException, SqsError, UnexcpectedList, UnexcpectedObject } from "../common/errors";
import { isJsObject } from "../common/utils";

export class DeleteMessage extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

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
      throw new ReceiptHandleIsInvalidException(this.reqBody.ReceiptHandle);
    }

    if (this.reqBody.ReceiptHandle.trim() == "") {
      throw new MissingParameterException("The request must contain the parameter ReceiptHandle.");
    }

    const ReceiptHandle = this.reqBody.ReceiptHandle;

    if (!this.foundQueue!.delete(ReceiptHandle)) {
      throw new ReceiptHandleIsInvalidException(ReceiptHandle);
    }

    this.res.end(this.#createResponse());
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<DeleteMessageResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
    </DeleteMessageResponse>`;
  }
}
