$(document).ready(function() {

    var socket = io.connect('http://localhost:3700/admin');

    socket.on('console', function (data) {
        $('.console').prepend("<pre>" + JSON.stringify(data) + "</pre>");
    });

    socket.on('updateControlPanel', function (data) {
        var html = "";
        for(var game in data) {
            console.log(JSON.stringify(game));
            if(data[game].isPlaying) {
                html += "<div class='game active'>";
            } else {
                html += "<div class='game'>";
            }
            html +=	"	<p class='gameTitle'>Game title: " + game + "</p>";
            if(data[game].player1Alive) {
                html += "<p class='playerName active" + data[game].player1State + "'>Player 1: " + data[game].player1 + "</p>";
            } else {
                html += "<p class='playerName'>Player 1: " + data[game].player1 + "</p>";
            }
            if(data[game].player2Alive) {
                html += "<p class='playerName active" + data[game].player2State + "'>Player 2: " + data[game].player2 + "</p>";
            } else {
                html += "<p class='playerName'>Player 2: " + data[game].player2 + "</p>";
            }
            if(data[game].mayStart) {
                html += "<a href='#' class='startGame' data-game='" + data[game].title + "'>Start game</a>&nbsp;";
            }
            if(data[game].isPlaying) {
                html += "<a href='#' class='stopGame' data-game='" + data[game].title + "'>Stop game</a>";
            }
            html += "</div>";
            $('.control').html(html);
        }
    });

    $('.updateOverview').click(function() {
        socket.emit('updateScreenOverview', {});
    });

    $('.updateCurrent').click(function() {
        socket.emit('updateScreenCurrent', {});
    });

    $('.updateAdmin').click(function() {
        socket.emit('updateAdmin', {});
    })

    $('.startGame').click(function() {
        var game = $(this).data("game");
        socket.emit('startGame', {value: game});
    });

    $('.stopGame').click(function() {
        var game = $(this).data("game");
        socket.emit('stopGame', {value: game});
    });

    $('.getHandshake').click(function() {
        socket.emit('getHandshake', {});
    })
});
