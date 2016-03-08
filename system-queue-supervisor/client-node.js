// MANEJO DEL SOCKET CON NODE-JS supervisor
// VERIFICO LA CONEXION CON EL SERVIDOR
var socket;
try{
    socket = io.connect('http://localhost:6969',{
      'reconnect': true,
      'reconnection delay': 5000,
      'max reconnection attempts': 10
    });
}catch(e){
    $("<div>Error de conexi&oacute;n al socket:<br>" + e + "</div>")
    .dialog({modal: true});
}
// FIN - MANEJO DEL SOCKET CON NODE-JS supervisor
var conectando_socket_sup;
setInterval(function(){
	if(!socket.socket.connected)
	{
		//console.log('SOCKET SUP DISCONNECT');
		conectando_socket_sup = true;
	}
	else
	{
		//console.log('SOCKET SUP CONNECT');
		if(conectando_socket_sup)
		{
			//console.log('conctando true');
			//console.log(conectando);
			conectando_socket_sup = false;
			user_conecting_super();
		}
	}
},1000);

function user_conecting_super()
{
	userExtension = $('#div-sip-account').text();
	data = {use_extension:userExtension, users_supervised:group_member}
	socket.emit('newUser',data);
}

socket.on('newChange',function(data){
	info = data.split('|');
	if(info[3] === undefined){queue_call='null'}else{queue_call=info[3]}
	queues = $('#queues').val().split(',');		       
	for(queue in queues)
	{
		queue_name = queues[queue];
		result = {
				'rows':
					[
		              {	
		            	  callerid: info[2],
		            	  estadotiempo: info[0]+'|00:00:00|'+queue_call,
		            	  defaultuser: info[1],
		            	  queue_name: queue_name
		              }
					]
				}
		agente_campana_cb(result);
	}
});

$(function(){
	setInterval(function(){
		$('.crono_agent').each(function(){
			time_all = $(this).text().split(':');
			hour = time_all[0];
			min = time_all[1];
			sec = time_all[2];	
			sec_total = parseInt(1)+(parseInt(parseInt(hour) * 3600) + parseInt(parseInt(min) * 60) + parseInt(sec)); 
			time_span = toHHMMSS(sec_total);
			$(this).text(time_span);
		});
		}, 1000);
});
