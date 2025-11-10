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
        //Take a request type
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
        //Take the project name
        {
          type: 'input',
          block_id: 'title_block',
          label: { type: 'plain_text', text: 'Title' },
          element: { type: 'plain_text_input', action_id: 'title_input' },
        },
        //Take the priority type
        {
          type: 'input',
          block_id: 'prio_block',
          label: { type: 'plain_text', text: 'Priority' },
          element: {
            type: 'static_select',
            action_id: 'prio_select',
            options: [
              { text: { type: 'plain_text', text: 'High' }, value: 'High' },
              { text: { type: 'plain_text', text: 'Medium' }, value: 'Medium' },
              { text: { type: 'plain_text', text: 'Low' }, value: 'Low' },
            ],
          },
        },
        //Take the assigned Team type
        {
          type: 'input',
          block_id: 'team_block',
          label: { type: 'plain_text', text: 'Team' },
          element: {
            type: 'static_select',
            action_id: 'team_select',
            options: [
              { text: { type: 'plain_text', text: 'Account Management' }, value: 'Account Management' },
              { text: { type: 'plain_text', text: 'Human Resources' }, value: 'Human Resources' },
              { text: { type: 'plain_text', text: 'Product Design' }, value: 'Product Design' },
              { text: { type: 'plain_text', text: 'Business Development' }, value: 'Business Development' },
            ],
          },
        },
        //!!!!!!!Attach File NOT DONE!!!!!!!!!

        //!!!!!!!Add Assignees NOT DONE!!!!!!!

        //Take a description of the request
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
  const prio = values.prio_block.prio_select.selected_option.value;
  const team = values.team_block.team_select.selected_option.value;

  // --- Create new Notion page ---
  await notion.pages.create({
    parent: { data_source_id: process.env.NOTION_DB_ID },
    properties: {

      'Project name': {
        rich_text: [{ text: { content: title } }],
      },

      //Select the type of ticket
      Type: {
        select: { name: type },
      },

      //Status of the ticket is set to "Not Started"
      Status: {
        select: { name: 'Not Started' },
      },

      //Start date of ticket
      'Start Date': {
        select: { date: today() }
      },

      //Select the priority of the ticket (High, Low, Medium)
      Priority: {
        select: { name: prio },
      },

      //Select the assigned team
      Team: {
        select: { name: team },
      },

      //Description of task to be completed
      Description: {
        rich_text: [{ text: { content: desc } }],
      },

      //Created by tag
      CreatedBy: {
        rich_text: [{ text: { content: user } }],
      },
      
    },
    // children: [
    //   {
    //     object: 'block',
    //     type: 'paragraph',
    //     paragraph: {
    //       rich_text: [{ text: { content: desc } }],
    //     },
    //   },
    // ],
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

