const { App } = require('@slack/bolt');
const { Client } = require('@notionhq/client');
require('dotenv').config();

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Helper function to get current date in ISO format
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

// Helper function to fetch dynamic options from Notion database
async function getNotionSelectOptions(propertyName) {
  try {
    const database = await notion.databases.retrieve({
      database_id: process.env.NOTION_DB_ID,
    });
    
    const property = database.properties[propertyName];
    if (property && property.select && property.select.options) {
      return property.select.options.map(option => ({
        text: { type: 'plain_text', text: option.name },
        value: option.name,
      }));
    }
    return [];
  } catch (error) {
    console.error(`Error fetching ${propertyName} options:`, error);
    return [];
  }
}

// "/hubspot-ticket" command call
app.command('/hubspot-ticket', async ({ ack, body, client }) => {
  await ack();

  // Fetch dynamic options from Notion
  const typeOptions = await getNotionSelectOptions('Type');
  const priorityOptions = await getNotionSelectOptions('Priority');
  const teamOptions = await getNotionSelectOptions('Team');

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
        // Request Type
        {
          type: 'input',
          block_id: 'type_block',
          label: { type: 'plain_text', text: 'Request Type' },
          element: {
            type: 'static_select',
            action_id: 'type_select',
            options: typeOptions.length > 0 ? typeOptions : [
              { text: { type: 'plain_text', text: 'Bug' }, value: 'Bug' },
              { text: { type: 'plain_text', text: 'Feature' }, value: 'Feature' },
              { text: { type: 'plain_text', text: 'Change' }, value: 'Change' },
            ],
          },
        },
        // Title
        {
          type: 'input',
          block_id: 'title_block',
          label: { type: 'plain_text', text: 'Title' },
          element: { type: 'plain_text_input', action_id: 'title_input' },
        },
        // Priority
        {
          type: 'input',
          block_id: 'prio_block',
          label: { type: 'plain_text', text: 'Priority' },
          element: {
            type: 'static_select',
            action_id: 'prio_select',
            options: priorityOptions.length > 0 ? priorityOptions : [
              { text: { type: 'plain_text', text: 'High' }, value: 'High' },
              { text: { type: 'plain_text', text: 'Medium' }, value: 'Medium' },
              { text: { type: 'plain_text', text: 'Low' }, value: 'Low' },
            ],
          },
        },
        // Team
        {
          type: 'input',
          block_id: 'team_block',
          label: { type: 'plain_text', text: 'Team' },
          element: {
            type: 'static_select',
            action_id: 'team_select',
            options: teamOptions.length > 0 ? teamOptions : [
              { text: { type: 'plain_text', text: 'Account Management' }, value: 'Account Management' },
              { text: { type: 'plain_text', text: 'Human Resources' }, value: 'Human Resources' },
              { text: { type: 'plain_text', text: 'Product Design' }, value: 'Product Design' },
              { text: { type: 'plain_text', text: 'Business Development' }, value: 'Business Development' },
            ],
          },
        },
        // Description
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

// Modal Submission Handler
app.view('ticket_modal_submit', async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.name;
  const values = view.state.values;

  const type = values.type_block.type_select.selected_option.value;
  const title = values.title_block.title_input.value;
  const desc = values.desc_block.desc_input.value;
  const prio = values.prio_block.prio_select.selected_option.value;
  const team = values.team_block.team_select.selected_option.value;

  try {
    // Create new Notion page
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DB_ID },
      properties: {
        // Title property
        Title: {
          title: [{ text: { content: title } }],
        },

        // Type of ticket
        Type: {
          select: { name: type },
        },

        // Status set to "Not Started"
        Status: {
          select: { name: 'Not started' },
        },

        // Start date
        'Start Date': {
          date: { start: getTodayISO() },
        },

        // Priority
        Priority: {
          select: { name: prio },
        },

        // Team
        Team: {
          select: { name: team },
        },

        // Description
        Description: {
          rich_text: [{ text: { content: desc } }],
        },
      },
    });

    // Confirm in Slack
    await client.chat.postMessage({
      channel: body.user.id,
      text: `Your *${type}* request "${title}" has been added to the Notion database.`,
    });
  } catch (error) {
    console.error('Error creating Notion page:', error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: `Sorry, there was an error creating your ticket: ${error.message}`,
    });
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log(`Bot app is running on port ${process.env.PORT || 3000}`);
})();