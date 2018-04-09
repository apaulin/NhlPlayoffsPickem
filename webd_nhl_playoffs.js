var express = require("express");
var router = express.Router();
var http = require('http');
var fs = require('fs');
var bodyParser = require('body-parser');
//var nodemailer = require('nodemailer');



var webRoot = "./";
var port = 8080;

var players = null;
var config = null;
var bracket = null;




var transporter = null;

var endPhrases = new Array(
	"I think I have been hacked.  Those can't possibly be your choices.  Someone must really wants to put a joke on you to submit these to your name!",
	"I am looking at these choices and I cannot stop laughing!!!",
	"Maybe next year you should enroll in a golf Pickem!!",
	"Well that 10$ did not last long...  Maybe next year...",
	//"You can change these picks until Thursday noon.  I strongly recommend that you do!",
	//"Mppffffftttt, mppffffftttt, mppffffftttt  POUHAHAHAHAHAHAAHA!!!!!  Those are f-u-n-n-y!!!!!\nThank you for that, my day was boring so far.",
	//"Are you picking your teams because you like their shirt color?  Sure looks like it...",
	//"Reminder, the goal of this game is to finish on top.  Looking at your picks, I figured you didn't know that.",
	//"You could at least make the effort of looking at the screen while making your picks!",
	//"I hope you at least have a great personality...",
	//"If your place in society was based based on these choices, you would have to go to jail.  These are a crime against hockey!!!!!!",
	//"Up until now the worst decision in gambling history was made by Pete Rose, you sadly beat him by a long stretch!",
	//"Maybe I should make an 'Insta-pick' feature just for you...",
	//"Geeeeeese... If you don't want to play anymore, just quit!",
	//"You are lucky my 'Rejected for stupidity' feature is not yet implemented.",
	//"Here's a New Year resolution for you: I will stop making bad football picks in 2018!",
	//"I hope you asked for some Football Wisdom for Christmas!",
	//"Luckily for you, the season ending is close!",
	"Based on these choices, I wouldn't watch TV all week if I were you..."

);

var endPhrasesPerso = [
];


//A sample GET request    
router.route("/stats").get(function(req, res) {
	debug("Got a GET request");
    res.send(fs.readFileSync("results.json", "utf8"));
});    

//A sample POST request
router.route("/results").post(function(req, res, next) {
	debug("Got POST Data " + req.body);
	fs.appendFile("./results.json",
                ",\n" + req.body, 
                "utf8",
				errorProcessing);
   res.send('Got Post Data');
   next();
   
});

var app = express();
app.use(bodyParser.text());
app.use(bodyParser.json());
app.use('/',router);
app.use('/',express.static(webRoot));

var errorProcessing = function(err)
{
	if (err) 
	{
		throw err;
	}
	else
	{
		debug('The "data to append" was appended to file!');
	}
}

var expressServer = app.listen(port,function()
{
	debug("Parsing Players File");
	var playersString = fs.readFileSync("playerEntries.json");
	players = JSON.parse(playersString);
	// Verify that the admin info is present
	if (players[0].name != "admin" || players[0].password == undefined)
	{
		debug("Invalid password file, admin info not present");
		process.exit(1);
	}
	debug("Parsing config");
	var configString = fs.readFileSync("config.json");
	config = JSON.parse(configString);
	debug("Parsing the bracket");
	var bracketString = fs.readFileSync("bracket.json");
	bracket = JSON.parse(bracketString);
	debug("Express Started");
});

router.route("/logininfo/:type/:arg1").get(function(req, res, next) 															 
{
	debug("GET Login Info");
	var playerNames = new Array();
	for(var i=1; i < players.length; i++)
	{
		playerNames.push(players[i].name);
	}
    res.send(JSON.stringify(playerNames, null, 2));
});

router.route("/logininfo/:username/:password").post(function(req, res, next) 															 
{
	var loginInfoString = req.body;
	var loginInfo = JSON.parse(loginInfoString);

	config.error = -1;
	debug("GET Login Attempt from " + loginInfo.username);
	for (var i = 0 ; i < players.length; i++)
	{
		if (players[i].name == loginInfo.username)
		{
			if (players[i].password == loginInfo.password)
			{
				config.error = 0;
			}
			else
			{
				console.log("WRONG PASSWORD " +  players[i].password + ":" + loginInfo.password); 
			}
		}
	}

	res.send(JSON.stringify(config, null, 2));
		
});

router.route("/bracketinfo/:type/:arg1").get(function(req, res, next) 															 
{
	debug("GET Bracket Info");
   res.send(JSON.stringify(bracket, null, 2));
});

router.route("/picksinfo/:type/:arg1").post(function(req, res, next)
{
	var picksInfoString = req.body;
	var picksInfo = JSON.parse(picksInfoString);
	var currentPlayer = null;
	if (config.pickPeriod == "true")
	{
		for(var i=0; i < players.length && currentPlayer == null; i++)
		{
			console.log("Comparing " + players[i].name + " with " + picksInfo.username);
			if(players[i].name == picksInfo.username && (players[i].password == undefined || players[i].password == picksInfo.password))
			{
				currentPlayer = players[i];
			}
		}
		if (currentPlayer != null)
		{
			currentPlayer["round" + config.round] = picksInfo["round" + config.round];
			var emailbody = "The following picks were received from " + currentPlayer.name + ": \n" + JSON.stringify(picksInfo["round" + config.round], null, 2) + "\n\n";
			emailbody += findEndPhrase(currentPlayer.name);

			fs.writeFileSync("playerEntries.json",
				JSON.stringify(players, null, 1),
				"utf8",
				errorProcessing);
			res.send(emailbody);
		}
		else
		{
			res.send("Could not found user");
		}
	}
	else
	{
		res.send("Not in Pick Period");
	}
	
});

router.route("/getseason/:type/:arg1").get(function(req, res, next) 															 
{
	//debug("GET Players");
	var seasonString = fs.readFileSync("season.json", "utf8");
	var seasonObj = JSON.parse(seasonString);
   res.send(JSON.stringify(seasonObj, null, 2));
});
								
router.route("/changeconfig/:type/:arg1").post(function(req, res, next) 
{
	var newConfigString = req.body;
	var newConfigObj = JSON.parse(newConfigString);
	debug((new Date()).toString() + ": Changing Config " + newConfigString);

	if (newConfigObj != null)
	{
		if (newConfigObj.password == players[0].password)
		{
			if (newConfigObj.config.round != undefined && newConfigObj.config.pickPeriod != undefined)
			{
				config = newConfigObj.config;
				fs.writeFileSync("config.json",
					JSON.stringify(config, null, 1),
					"utf8",
					errorProcessing);
				
				res.send('SUCCESS: Config changed.');
				
			}
			else
			{
				res.send('FAIL: missing info');
			}
		}
		else
		{
			res.send('FAIL: Wrong password');
		}
	}
   next();
});


router.route("/changeplayers/:type/:arg1").post(function(req, res, next) 
{
	var newConfigString = req.body;
	var newConfigObj = JSON.parse(newConfigString);
	debug((new Date()).toString() + ": Changing Config " + newConfigString);

	if (newConfigObj != null)
	{
		if (newConfigObj.password == players[0].password)
		{
			if (newConfigObj.players != undefined && newConfigObj.players.length >= 2)
			{
				players = newConfigObj.players;
				fs.writeFileSync("playerEntries.json",
					JSON.stringify(players, null, 1),
					"utf8",
					errorProcessing);
				
				res.send('SUCCESS: Players changed.');
				
			}
			else
			{
				res.send('FAIL: missing info');
			}
		}
		else
		{
			res.send('FAIL: Wrong password');
		}
	}
   next();
});

router.route("/changebracket/:type/:arg1").post(function(req, res, next) 
{
	var newConfigString = req.body;
	var newConfigObj = JSON.parse(newConfigString);
	debug((new Date()).toString() + ": Changing Bracket " + newConfigString);

	if (newConfigObj != null)
	{
		if (newConfigObj.password == players[0].password)
		{
			if (newConfigObj.bracket != undefined && newConfigObj.bracket.round1 != undefined)
			{
				bracket = newConfigObj.bracket;
				fs.writeFileSync("bracket.json",
					JSON.stringify(bracket, null, 1),
					"utf8",
					errorProcessing);
				
				res.send('SUCCESS: Bracket changed.');
				
			}
			else
			{
				res.send('FAIL: missing info');
			}
		}
		else
		{
			res.send('FAIL: Wrong password');
		}
	}
   next();
});






															 
router.route("/changeseason/:type/:arg1").post(function(req, res, next) 
{
	var newSeasonString = req.body;
	var newSeasonObj = JSON.parse(newSeasonString);

	if (newSeasonObj != null)
	{
		if (newSeasonObj.password == passwords[0].password)
		{
			season = newSeasonObj.season;
			var ret = validateSeason(season);
			if (ret == true)
			{
				fs.writeFileSync("season.json",
					JSON.stringify(season, null, 1),
					"utf8",
					errorProcessing);
				
				res.send('SUCCESS: Season changed.');
			}
			else
			{
				res.send("Wrong season format " + JSON.stringify(season, null, 2));
			}
				
		}
		else
		{
			res.send('FAIL: Wrong password');
		}
	}
   next();
});

router.route("/changeresults/:type/:arg1").post(function(req, res, next) 
{
	var newResultsString = req.body;
	var newResultsObj = JSON.parse(newResultsString);
	//debug((new Date()).toString() + ": Changing Result " + newResultsString);

	if (newResultsObj != null)
	{
		if (newResultsObj.password == passwords[0].password)
		{
			if (newResultsObj.results != undefined && newResultsObj.results != "")
			{
				fs.writeFileSync("results.js",
					newResultsObj.results,
					"utf8",
					errorProcessing);
				
				res.send('SUCCESS: Results changed.');
				
			}
			else
			{
				res.send('FAIL: missing info');
			}
		}
		else
		{
			res.send('FAIL: Wrong password');
		}
	}
   next();
});
															 
router.route("/submitPicks/:type/:arg1").post(function(req, res, next) 
{
	var newPick = JSON.parse(req.body);
	if (newPick != null)
	{
		if (checkPassword(newPick) == true)
		{
			if (newPick.pick.week == config.week && config.draftPeriod == "true")
			{
				var ret = placePick(newPick)
				var emailbody = "The following picks were received from " + newPick.name + ": \n" + JSON.stringify(newPick.pick, null, 2) + "\n\n";
				emailbody += findEndPhrase(newPick.name);
				
				if (ret == 1)
				{
					//sendEmail(newPick, 1);
					debug('SUCCESS: Added Pick.\n' + emailbody);
					res.send('SUCCESS: Added Pick.\n' + emailbody);
				}
				else if (ret == 2)
				{
					//sendEmail(newPick, 2);
					debug('SUCCESS: Replaced Pick.\n' + emailbody);
					res.send('SUCCESS: Replaced Pick.\n' + emailbody);
				}
				else
				{
					debug('FAIL: Cannot place pick.');
					res.send('FAIL: Cannot place pick.');
				}
			}
			else
			{
				debug('FAIL: Wrong week or not in draft period');
				res.send('FAIL: Wrong week or not in draft period');
			}
		}
		else
		{
			debug('FAIL: Invalid Password');
			res.send('FAIL: Invalid Password');
		}
	}
	else
	{
		debug('FAIL: Invalid Request');
		res.send('FAIL: Invalid Request');
	}
	
   next();
   
});

var placePick = function(newPick)
{
	for(var i=0; i < players.length; i++)
	{
		if (players[i].name == newPick.name)
		{
			for(var w=0; w < players[i].weeks.length; w++)
			{
				if (players[i].weeks[w].week == newPick.pick.week)
				{
					players[i].weeks[w] = newPick.pick;
					fs.writeFileSync("players.json",
						JSON.stringify(players, null, 1),
						"utf8",
						errorProcessing);
					return 2;
				}
			}
			players[i].weeks.push(newPick.pick);
			fs.writeFileSync("players.json",
				JSON.stringify(players, null, 1),
				"utf8",
				errorProcessing);
			return 1;
		}
		
	}
	
	debug("Cannot place: " + newPick.name + " Week: " + newPick.pick.week);
	return -1;
}

var checkPassword = function(newPick)
{
	var ret = false;
	
	for(var i = 0; i < passwords.length && ret==false; i++)
	{
		if (passwords[i].name == newPick.name && (passwords[i].password == newPick.password || passwords[i].password == ""))
		{
			ret = true;
		}
	}
		 
	return ret;
}



var sendEmail = function(newPick, retCode)
{
	var ret = false;
	for(var i = 0; i < passwords.length && ret==false; i++)
	{
		if (passwords[i].name == newPick.name && passwords[i].email != undefined && passwords[i].email != "")
		{
			var emailbody = "The following picks were received : \n" + newPick.pick + "\n\n" + endPhrases[Math.floor(Math.random() * endPhrases.length)] + "\n\nThe WebServer";
			var mailOptions = {
			  from: emailConfig.use,
			  to: passwords[i].email,
			  subject: "NFL Pickem Week " + config.week + ". Your pick were received.",
			  text: emailbody
			};

			transporter.sendMail(mailOptions, function(error, info){
			  if (error) {
				 debug(error);
			  } else {
				 debug('Email sent: ' + info.response);
			  }
			});			
			ret = true;
		}
	}
	
	return ret;
	
}

var validateSeason = function(s)
{
	var ret = true;
	
	if (s.length != 17)
	{
		ret = false;
	}
	else
	{
		for (var i = 0; i < s.length && ret == true; i++)
		{
			if (s[i].matchups.length <= 10)
			{
				ret = false;
				debug ("Not enough game in week " + (i+1)); 
			}
			else if (s[i].bye == undefined)
			{
				ret = false;
				debug ("No bye member in week " + (i+1));
			}
			else if (s[i].designatedMatchUp == undefined)
			{
				ret = false;
				debug ("No designatedMatchUp member in week " + (i+1));
			}
		}
	}
	
	
	return ret;
}

var findEndPhrase = function(name)
{
	var ret =  endPhrases[Math.floor(Math.random() * endPhrases.length)];
	
	for(var i=0; i < endPhrasesPerso.length; i++)
	{
		if (endPhrasesPerso[i].name == name)
		{
			var phrases = endPhrasesPerso[i].phrases
			ret = phrases[Math.floor(Math.random() * phrases.length)];
		}
	}
	ret +=  "\n\nThe WebServer";
	
	return ret;
}

var debug = function(str)
{
	console.log("----- " + (new Date()).toString() + " ----");
	console.log(str);
}
