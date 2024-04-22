import { SqsCommand } from "./sqsCommand";
import { MissingParameterException, InvalidParameterValueException } from "../common/errors";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { FORBIDDEN_POLICY_ACTIONS, VALID_POLICY_ACTIONS } from "../common/constants";

export class AddPermission extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const { Actions, AWSAccountIds, Label } = this.reqBody;

    if (!Label) {
      throw new MissingParameterException("The request must contain the parameter Label.");
    }

    if (!Array.isArray(Actions) || !Actions.length) {
      throw new MissingParameterException("The request must contain the parameter ActionName.");
    }

    const foundForbiddenAction = Actions.find((x) => FORBIDDEN_POLICY_ACTIONS.includes(x));

    if (foundForbiddenAction) {
      throw new InvalidParameterValueException(
        `Value SQS:${foundForbiddenAction} for parameter ActionName is invalid. Reason: Only the queue owner is allowed to invoke this action.`
      );
    }

    const foundInvalidAction = Actions.find((x) => !VALID_POLICY_ACTIONS.includes(x));

    if (foundInvalidAction) {
      throw new InvalidParameterValueException(
        `Value SQS:${foundInvalidAction} for parameter ActionName is invalid. Reason: Please refer to the appropriate WSDL for a list of valid actions.`
      );
    }

    if (!Array.isArray(AWSAccountIds) || !AWSAccountIds.length) {
      throw new MissingParameterException("The request must contain the parameter AWSAccountIds.");
    }

    this.foundQueue!.addPermission(Actions, AWSAccountIds, Label);
    this.res.end(this.#createResponse());
  }

  #setBody() {
    if (!this.isJsonProtocol) {
      if (this.reqBody.ActionName) {
        this.reqBody.Actions = this.reqBody.ActionName;
        delete this.reqBody.ActionName;
      }

      if (this.reqBody.AWSAccountId) {
        this.reqBody.AWSAccountIds = this.reqBody.AWSAccountId;
        delete this.reqBody.AWSAccountId;
      }
    }
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<AddPermissionResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
    </AddPermissionResponse>`;
  }
}
