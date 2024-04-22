import { SqsCommand } from "./sqsCommand";
import { MissingParameterException } from "../common/errors";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class RemovePermission extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

    const { Label } = this.reqBody;

    if (!Label) {
      throw new MissingParameterException("The request must contain the parameter Label.");
    }

    this.foundQueue!.removePermission(Label);
    this.res.end(this.#createResponse());
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<RemovePermissionResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
    </RemovePermissionResponse>`;
  }
}
