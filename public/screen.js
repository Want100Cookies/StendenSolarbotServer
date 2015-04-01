$(document).ready(function() {

    var socket = io.connect('http://localhost:3700/screen');

    socket.on('console', function (data) {
        console.log(data);
    });

    socket.on('updateCurrent', function (data) {
        $('.currentGameTitle').html(data.title);
        $('.currentPlayerName1').html(data.playerName1);
        $('.currentPlayerName2').html(data.playerName2);
        $('.currentPlayerPoints1').html(data.playerPoints1);
        $('.currentPlayerPoints2').html(data.playerPoints2);
        if(data.player1Alive) {
            $('.player1').attr('class', 'col-md-5 player1 alive');
        } else {
            $('.player1').attr('class', 'col-md-5 player1');
        }
        if(data.player2Alive) {
            $('.player2').attr('class', 'col-md-5 player2 alive');
        } else {
            $('.player2').attr('class', 'col-md-5 player2');
        }
    });

    socket.on('updateOverview', function (data) {
        var html = "";
        for(var game in data) {
            html += "<div class='col-md-2'>" +
                    "	<div class='col-md-12'>" +
                    "		<h3>" + game + "</h3>" +
                    "	</div>";
            if(data[game].player1Alive) {
                html +=	"<div class='col-md-6 alive'>";
            } else {
                html +=	"<div class='col-md-6'>";
            }
            html +=	"		<b>" + data[game].playerName1 + "</b>" +
                    "		<p>" + data[game].playerPoints1 + "</p>" +
                    "	</div>";
            if(data[game].player2Alive) {
                html +=	"<div class='col-md-6 alive'>";
            } else {
                html +=	"<div class='col-md-6'>";
            }
            html +=	"		<b>" + data[game].playerName2 + "</b>" +
                    "		<p>" + data[game].playerPoints2 + "</p>" +
                    "	</div>" +
                    "</div>";
        }
        $('.overView').html(html);
    });

    socket.on("timer", function(data) {
        if(data.status == "countDown") {
            $(".timer").html("<h1>Get ready!</h1><h1>" + data.time + "</h1>");
        } else if(data.status == "game") {
            $(".timer").html("<h1><small>Game time:</small><br>" + data.time + "</h1>");
        } else if(data.status == "begin"){
            $(".timer").html("<h1>Begin!</h1>")
        } else if(data.status == "empty"){
            $(".timer").html("");
        } else {
            console.log("Error processing data on timer: " + JSON.stringify(data));
        }
    });

});
