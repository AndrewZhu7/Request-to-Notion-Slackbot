const {App} = require('@slack/bolt');
require('dotenv').config();

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
});

//"/hubspot-ticket" command call
app.command('/hubspot-ticket', async ({ ack, body, client }) => {
  await ack();

  // Open the modal
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'ticket_modal_submit',
      title: { type: 'plain_text', text: 'New Internal Request' },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'input',
          block_id: 'type_block',
          label: { type: 'plain_text', text: 'Request Type' },
          element: {
            type: 'static_select',
            action_id: 'type_select',
            options: [
              { text: { type: 'plain_text', text: 'Bug' }, value: 'Bug' },
              { text: { type: 'plain_text', text: 'Feature' }, value: 'Feature' },
              { text: { type: 'plain_text', text: 'Change' }, value: 'Change' },
            ],
          },
        },
        {
          type: 'input',
          block_id: 'title_block',
          label: { type: 'plain_text', text: 'Title' },
          element: { type: 'plain_text_input', action_id: 'title_input' },
        },
        {
          type: 'input',
          block_id: 'desc_block',
          label: { type: 'plain_text', text: 'Description' },
          element: {
            type: 'plain_text_input',
            multiline: true,
            action_id: 'desc_input',
          },
        },
      ],
    },
  });
});


// --- Modal Submission Handler ---
app.view('ticket_modal_submit', async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.name;
  const values = view.state.values;

  const type = values.type_block.type_select.selected_option.value;
  const title = values.title_block.title_input.value;
  const desc = values.desc_block.desc_input.value;

  // --- Create new Notion page ---
  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: title } }],
      },
      Type: {
        select: { name: type },
      },
      Status: {
        select: { name: 'Backlog' }, // initial status column
      },
      CreatedBy: {
        rich_text: [{ text: { content: user } }],
      },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: desc } }],
        },
      },
    ],
  });

    // --- Confirm in Slack ---
  await client.chat.postMessage({
    channel: body.user.id,
    text: `Your *${type}* request "${title}" has been added to the Notion Kanban board.`,
  });
});

(async () => {
    await app.start(process.env.PORT || 3000);
    console.log(`Bot app is running on port $(process.env.PORT || 3000})`)
});

