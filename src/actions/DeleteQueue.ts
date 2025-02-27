import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class DeleteQueue extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

    if (!this.service.emulateQueueCreationLifecycle) {
      this.foundQueue!.clearRecords();

      const foundIndex = this.service.Queues.findIndex((x) => x.QueueName == this.foundQueue!.QueueName);

      if (foundIndex != -1) {
        this.service.Queues.splice(foundIndex, 1);
      }

      this.res.end(this.#createResponse());
      return;
    }

    const cb = () => {
      const foundIndex = this.service.Queues.findIndex((x) => x.QueueName == this.foundQueue!.QueueName);

      if (foundIndex != -1) {
        this.service.Queues.splice(foundIndex, 1);
      }

      this.service.deletingQueues.delete(this.foundQueue!.QueueName);
    };

    this.foundQueue!.purge(cb);

    this.service.deletingQueues.add(this.foundQueue!.QueueName);

    this.res.end(this.#createResponse());
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<DeleteQueueResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
    </DeleteQueueResponse>`;
  }
}
