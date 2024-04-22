import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { PurgeQueueInProgress } from "../common/errors";

export class PurgeQueue extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

    if (this.foundQueue!.purge()) {
      this.res.end(this.#createResponse());
    } else {
      throw new PurgeQueueInProgress(this.foundQueue!.QueueName);
    }
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<PurgeQueueResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
    </PurgeQueueResponse>`;
  }
}
