import { UnsupportedOperation } from "../common/errors";
import { SqsCommand } from "./sqsCommand";

export class UnknownOperation extends SqsCommand {
  async exec() {
    throw new UnsupportedOperation(this.reqBody.Action ? `Action ${this.reqBody.Action} is currently not supported.` : "Your request must include Action parameter.");
  }
}
