import { SqsCommand } from "./sqsCommand";
import { Queue } from "../lib/queue";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class DeleteQueue extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

    if (!Queue.emulateQueueCreationLifecycle) {
      this.foundQueue!.clearRecords();

      const foundIndex = Queue.Queues.findIndex((x) => x.QueueName == this.foundQueue!.QueueName);

      if (foundIndex != -1) {
        Queue.Queues.splice(foundIndex, 1);
      }

      this.res.end(this.#createResponse());
      return;
    }

    const cb = () => {
      const foundIndex = Queue.Queues.findIndex((x) => x.QueueName == this.foundQueue!.QueueName);

      if (foundIndex != -1) {
        Queue.Queues.splice(foundIndex, 1);
      }

      Queue.deletingQueues.delete(this.foundQueue!.QueueName);
    };

    this.foundQueue!.purge(cb);

    Queue.deletingQueues.add(this.foundQueue!.QueueName);

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
