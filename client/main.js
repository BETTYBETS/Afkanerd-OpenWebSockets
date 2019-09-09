const Tools = require('./../globals/tools.js')
const Socket = require ('net');
const JsonSocket = require('json-socket');
const Sebastian = require('./sebastian.js');
const { spawn, spawnSync,fork } = require('child_process');
const SMS = require('./../globals/sms.js');
require('dotenv').config({path: 'whoami.env'})
'use strict';

//TODO: start pm2 manually and keep restarting using name in app
//TODO: start pm2 with app and keep restarting it


const TCP_HOST_NAME = process.env.TCP_HOST_NAME;
const TCP_HOST_PORT = process.env.TCP_HOST_PORT;
const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
const CLIENT_UUID = process.env.CLIENT_UUID;
const APP_TYPE = process.env.APP_TYPE

let startScript = async ( sebastian )=>{
//Let's begin, le dance macabre
	var sms = new SMS;
	var socket = new JsonSocket(new Socket.Socket());

	var startSocketConnection = ()=> {
		console.log('state=> starting socket connection....');
		const options = {
			host : TCP_HOST_NAME,
			port : TCP_HOST_PORT
		}

		socket.connect(options, function(){
			console.log("socket.connect=> connected..."); 
			socket.sendMessage({
				type:"auth", 
				clientToken:CLIENT_TOKEN, 
				UUID:CLIENT_UUID,
				appType:APP_TYPE
			});
			socket.setKeepAlive({
				enable : true
			});
		});
	}

	let mysqlConnection = await Tools.mysql_connection();

	startSocketConnection();
	socket.on('error', async ( error ) => {
		console.log("socket.error=> [", error.code, "]", error.message);

		switch( error.code ) {
			case 'ENOENT':
				console.log("socket.error=> check configuration parameters... possibly wrong settings");
				await Tools.sleep();
				socket = null; //This is murder!!
				sebastian.emit("safemenow!", sebastian);
				return;
			break;

			case 'ECONNREFUSED':
				console.log("socket.error=> server doesn't seem to be running, check port or call devs");
				await Tools.sleep();
				socket = null; //This is murder!!
				sebastian.emit("safemenow!", sebastian);
				return;
			break;


			case 'ECONNRESET':
				console.log("socket.error=> TCP abrupt termination of connection, if this continues call devs");
				await Tools.sleep();
				socket = null; //This is murder!!
				sebastian.emit("safemenow!", sebastian);
				return;
			break;

			case 'EADDRNOTAVAIL':
				console.log("socket.error=> most probably running from a mac laptop or why don't you have localhost??");
				await Tools.sleep();
				socket = null;
				sebastian.emit("safemenow!", sebastian);
				return

			default:
				socket = null;
				sebastian.emit("safemenow!", sebastian);
			break;
		}
	});


	socket.on('message', (data ) => {
		console.log("socket.message=> new message...");
		try {
			if(typeof data.type !== undefined) {
				switch( data.type ) {
					case "terminal":
						console.log("socket.message=> running a config command");
						let terminalType = data.payload.terminalType;
						switch( terminalType ) {
							case "update":
								console.log("socket.message.terminal=> received command for update");
								sebastian.update();
							break;

							case "reload":
								console.log("socket.message.reload=> received command for reload");
							break;
						}
					break;

					case "sms":
						console.log("socket.message=> SMS requested...");
						sms.sendBulkSMS(data.payload).then((resolve, reject)=>{
							socket.sendMessage({
								"type" : "confirmation",
								"CLIENT_TOKEN" : CLIENT_TOKEN,
								"CLIENT_UUID" : CLIENT_UUID,
								"DATA_TYPE" : data.type,
								"MESSAGE" : "finished forwarding a bulk message",
								"RESOLVE" : resolve
							})
						});
					break;

					default:
						console.log("socket.message=> running default state for:", data.type);
						let options = {
							detached: true,
							stdio : ['inherit', 'inherit', 'inherit']
						}
						const newProcess = spawn(data.type, data.payload, options);
						newProcess.unref();
					break;
				}
			}
			else {
				throw new Error("unknown request type");
			}
		}
		catch(error) {
			console.log("socket.message.error=> ", error.message);
		}
	})

	socket.on('close', async ( hadError )=> {
		switch( hadError ){
			case true:
				console.log("socket.close=> failed due to transmission error, check internet connection");
			break;

			case false:
				console.log("socket.close=> was murdered by the server.... call Sherlock (Holmes)");
				socket = null;
				sebastian.emit("safemenow!", sebastian);
			break;

			default:
				console.log("socket.close=> I'm just confused now....");
			break;
		}
	});
}

var sebastian = new Sebastian;
startScript(sebastian);
sebastian.on("safemenow!", startScript);
//TODO: Add important things to process file
