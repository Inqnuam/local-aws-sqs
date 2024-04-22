import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class ListQueueTags extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();

    this.res.end(this.#createResponse(this.foundQueue!.Tags));
  }

  #createResponse(Tags: any) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ Tags });
    }

    let ListQueueTagsResult = "<ListQueueTagsResult>";

    const keys = Object.keys(Tags);

    if (keys.length) {
      keys.forEach((k) => {
        ListQueueTagsResult += `<Tag>
        <Key>${k}</Key>
        <Value>${Tags[k]}</Value>
     </Tag>`;
      });

      ListQueueTagsResult += "</ListQueueTagsResult>";
    } else {
      ListQueueTagsResult = "<ListQueueTagsResult/>";
    }
    const body = `${xmlVersion}<ListQueueTagsResponse ${xmlns}>
    ${ListQueueTagsResult}
    ${ResponseMetadata(this.RequestId)}
  </ListQueueTagsResponse>`;

    return body;
  }
}
