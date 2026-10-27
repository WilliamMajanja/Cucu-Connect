require 'facebook/messenger'

include Facebook::Messenger

Bot.on :message do |message|
  puts "Received '#{message.inspect}' from #{message.sender}"

  case message.text
  when /hello/i
    message.reply(
      text: 'Hello, human!',
      quick_replies: [
        {
          content_type: 'text',
          title: 'Hello, bot!',
          payload: 'HELLO_BOT'
        }
      ]
    )
  when /something humans like/i
    message.reply(
      text: 'I found something humans seem to like:'
    )

    message.reply(
      attachment: {
        type: 'image',
        payload: {
          url: 'https://i.imgur.com/iMKrDQc.gif'
        }
      }
    )

    message.reply(
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'Did human like it?',
          buttons: [
            { type: 'postback', title: 'Yes', payload: 'HUMAN_LIKED' },
            { type: 'postback', title: 'No', payload: 'HUMAN_DISLIKED' }
          ]
        }
      }
    )
  else
    message.reply(
      text: 'You are now marked for extermination.'
    )

    message.reply(
      text: 'Have a nice day.'
    )
  end
end

Bot.on :postback do |postback|
  case postback.payload
  when 'HUMAN_LIKED'
    text = 'That makes bot happy!'
  when 'HUMAN_DISLIKED'
    text = 'Oh.'
  end

  postback.reply(
    text: text
  )
end

Bot.on :delivery do |delivery|
# bot.rb
require 'facebook/messenger'

include Facebook::Messenger

Bot.on :message do |message|
  message.id          # => 'mid.1457764197618:41d102a3e1ae206a38'
  message.sender      # => { 'id' => '1008372609250235' }
  message.seq         # => 73
  message.sent_at     # => 2016-04-22 21:30:36 +0200
  message.text        # => 'Hello, bot!'
  message.attachments # => [ { 'type' => 'image', 'payload' => { 'url' => 'https://www.example.com/1.jpg' } } ]

  message.reply(text: 'Hello, human!')
end

  puts "Delivered message(s) #{delivery.ids}"
end

Bot.deliver({
  recipient: {
    id: '45123'
  },
  message: {
    text: 'Human?'
  }
}, access_token: ENV['ACCESS_TOKEN'])

message.reply(
  attachment: {
    type: 'image',
    payload: {
      url: 'http://sky.net/visual-aids-for-stupid-organisms/pig.jpg'
    }
  }
)

message.reply(
  text: 'Human, who is your favorite bot?',
  quick_replies: [
    {
      content_type: 'text',
      title: 'You are!',
      payload: 'HARMLESS'
    }
  ]
)

message.reply(
  attachment: {
    type: 'template',
    payload: {
      template_type: 'button',
      text: 'Human, do you like me?',
      buttons: [
        { type: 'postback', title: 'Yes', payload: 'HARMLESS' },
        { type: 'postback', title: 'No', payload: 'EXTERMINATE' }
      ]
    }
  }
)

Bot.on :postback do |postback|
  postback.sender    # => { 'id' => '1008372609250235' }
  postback.recipient # => { 'id' => '2015573629214912' }
  postback.sent_at   # => 2016-04-22 21:30:36 +0200
  postback.payload   # => 'EXTERMINATE'

  if postback.payload == 'EXTERMINATE'
    puts "Human #{postback.recipient} marked for extermination"
  end
end

Bot.on :message do |message|  
  message.typing_on

  # Do something expensive

  message.reply(text: 'Hello, human!')
end

Bot.on :message do |message|  
  message.typing_on

  if # something
    message.reply(text: 'Hello, human!')
  else
    message.typing_off
  end
end

Bot.on :message do |message|
  message.mark_seen
end

Bot.on :optin do |optin|
  optin.sender    # => { 'id' => '1008372609250235' }
  optin.recipient # => { 'id' => '2015573629214912' }
  optin.sent_at   # => 2016-04-22 21:30:36 +0200
  optin.ref       # => 'CONTACT_SKYNET'

  optin.reply(text: 'Ah, human!')
end

Bot.on :delivery do |delivery|
  delivery.ids       # => 'mid.1457764197618:41d102a3e1ae206a38'
  delivery.sender    # => { 'id' => '1008372609250235' }
  delivery.recipient # => { 'id' => '2015573629214912' }
  delivery.at        # => 2016-04-22 21:30:36 +0200
  delivery.seq       # => 37

  puts "Human was online at #{delivery.at}"
end

Bot.on :referral do |referral|
  referral.sender    # => { 'id' => '1008372609250235' }
  referral.recipient # => { 'id' => '2015573629214912' }
  referral.sent_at   # => 2016-04-22 21:30:36 +0200
  referral.ref       # => 'MYPARAM'
end

Facebook::Messenger::Thread.set({
  setting_type: 'greeting',
  greeting: {
    text: 'Welcome to your new bot overlord!'
  },
}, access_token: ENV['ACCESS_TOKEN'])

Facebook::Messenger::Thread.set({
  setting_type: 'call_to_actions',
  thread_state: 'new_thread',
  call_to_actions: [
    {
      payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_WELCOME'
    }
  ]
}, access_token: ENV['ACCESS_TOKEN'])

Facebook::Messenger::Thread.set({
  setting_type: 'call_to_actions',
  thread_state: 'existing_thread',
  call_to_actions: [
    {
      type: 'postback',
      title: 'Help',
      payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_HELP'
    },
    {
      type: 'postback',
      title: 'Start a New Order',
      payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_START_ORDER'
    },
    {
      type: 'web_url',
      title: 'View Website',
      url: 'http://example.com/'
    }
  ]
}, access_token: ENV['ACCESS_TOKEN'])

export ACCESS_TOKEN=EAAAG6WgW...
export APP_SECRET=a885a...
export VERIFY_TOKEN=95vr15g...

class ExampleProvider < Facebook::Messenger::Configuration::Providers::Base
  def valid_verify_token?(verify_token)
    bot.exists?(verify_token: verify_token)
  end

  def app_secret_for(page_id)
    bot.find_by(page_id: page_id).app_secret
  end

  def access_token_for(page_id)
    bot.find_by(page_id: page_id).access_token
  end

  private

  def bot
    MyApp::Bot
  end
end

Facebook::Messenger.configure do |config|
  config.provider = ExampleProvider.new
end

