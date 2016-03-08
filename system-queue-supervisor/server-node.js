// iniciamos el servidor indicando el puerto
var io = require('/usr/local/lib/node_modules/socket.io').listen(6969, { log: false });
//console.log(io);
// libreria pg (postgre)
pg = require('/usr/local/lib/node_modules/pg');
// CONSTANTES GLOBALES PARA CONEXION A BASE DE DATOS
var mysql,cnn,pg,resCam,ageCam,indCam,countCall;
y = false;
number_users = 0;
supervisor_agents = [];

var conString = "pg://user:p2ssw4r@localhost:5432/data_base";
var client_listen_notify = new pg.Client(conString);
client_listen_notify.connect(function(err){
	if(err)
	{
		return console.error('could not connect to postgres', err);
	}		  
});
	
io.on('connection', function(socket){
	
	client_listen_notify.on('notification', function(msg){
		emit_event(msg.payload);
	});

	socket.on('newUser',function(data){
		users_supervised = data.users_supervised.split(',').sort();
		supervisor_agents[socket.id] = {"use_extension":data.use_extension,"users_supervised":users_supervised}
		console.log(supervisor_agents);
	});
	
	function emit_event(payload)
	{
		
		for(supervisor in supervisor_agents)
		{
			extension_payload = payload.split('|')[1];
			users_supervised = supervisor_agents[supervisor].users_supervised 
			exist = users_supervised.indexOf(extension_payload);
			if(exist >= 0)
			{
				io.sockets.socket(supervisor).emit("newChange",payload);
			}
		}
	}
	++number_users;
	console.log(number_users+" NUMBER USERS");
	if(number_users > 0){
		
		if(y == false)
		{
			console.log('QUERYS LISTEN');
			var query_listen_agents = client_listen_notify.query("LISTEN events_agents");
	         resumen_campana();
	         //agente_campana();
	         count_calls();
	         campana_tmo_ta_tr();
	    }
	}
    socket.on('disconnect', function(){
        delete supervisor_agents[socket.id];
    // remove the username from global usernames list
      --number_users;
      console.log(number_users+" NUMBER USERS");
      if(number_users == 0)
      {
    	  //clearInterval(ageCam);
    	  clearInterval(resCam);
    	  clearInterval(countCall);
          clearInterval(indCam);
    	  console.log('ningun usuario CLEAR INTERVAL UNLISTEN');
    	  var query_listen_agents = client_listen_notify.query("UNLISTEN events_agents");
    	  y = false;
      }
      console.log(supervisor_agents);
  });

function resumen_campana()
{
			var sql = "	select g.\"name\" as queuename, ";
				sql += "				case when qe.recibidas is null then 0 else ((abandonadas*100)/qe.recibidas) end ta,"; 
				sql += "				case when qe.ns is null then 0 else qe.ns end ns";
				sql += "				from groups g";
				sql += "				left join (select  qe.queue,";
				sql += "						count(*)  recibidas,";
				sql += "						sum(case when (qe.agent_callerid IN ('NotAvailable','NotReceived') and qe.status= 'A') or"; 
				sql += "						(qe.agent_startdate = '0001-01-01 00:00:00' AND qe.agent_enddate = '0001-01-01 00:00:00' AND qe.status= 'A') then 1 else 0 end) abandonadas,";
				sql += "						((sum(case when (EXTRACT(EPOCH FROM cast(coalesce((qe.agent_startdate - qe.entry_startdate)) as interval))) <= 20 AND qe.agent_startdate >= qe.entry_startdate then 1 else 0 end))*100)/";
				sql += "						case when (count(*)- sum(case when cast((EXTRACT(EPOCH FROM (qe.entry_enddate - qe.entry_startdate))) as bigint) <= 10 and status= 'A'  AND (qe.agent_callerid IN ('NotAvailable','NotReceived')  OR";
				sql += "						(agent_startdate = '0001-01-01 00:00:00' AND agent_enddate = '0001-01-01 00:00:00')) then 1 else 0 end)) < 1 then 1 else (count(*)- sum(case when cast((EXTRACT(EPOCH FROM (qe.entry_enddate - qe.entry_startdate))) as bigint) <= 10 and status= 'A'  AND (qe.agent_callerid IN ('NotAvailable','NotReceived')  OR";
				sql += "						(agent_startdate = '0001-01-01 00:00:00' AND agent_enddate = '0001-01-01 00:00:00')) then 1 else 0 end)) end AS ns ";
				sql += "					from queue_entry qe ";
				sql += "					where to_char(entry_startdate,'YYYY-MM-DD') = to_char(now(),'YYYY-MM-DD')";
				sql += "					group by qe.queue) qe on g.name=qe.queue;";
    //console.log(sql);
	if(number_users > 0)
	{
	    resCam = setInterval(function()
	    {
	        query(sql, 'resumen_campana_cb'); // query, funcion de retorno (cliente)
	    },10000);
	    y = true;
	}
}

function agente_campana()
{
	var sql = " SELECT (op.firstname || ' ' || op.lastname) AS callerid,  ";
		sql += "  CASE WHEN fin.datetime_end is null then ";
		sql += " case when aud.id_break is null then ";
		sql += " ( '0|' ||((EXTRACT(EPOCH FROM (NOW() - aud.datetime_init))) * '1 second'::interval||'|' || aud.queue_member)) /*Conectado Disponible*/ ";
		sql += " else ";
		sql += " case when aud.datetime_end is null then ";
		sql += " ( aud.id_break||'|' ||((EXTRACT(EPOCH FROM (NOW() - aud.datetime_init))) * '1 second'::interval||'|' || aud.queue_member)) /*Break*/ ";
		sql += " else ";
		sql += " ( '0|' ||((EXTRACT(EPOCH FROM (NOW() - aud.datetime_end))) * '1 second'::interval||'|' || fin.queue_member)) /*Disponible*/ ";
		sql += " end ";
		sql += " end ";
		sql += " else ";
		sql += " ( '0|' ||'0|' || fin.queue_member) /*No Conectado*/ ";
		sql += " end   AS estadotiempo, ";
		sql += " aud.ext_number AS defaultuser, ";
		sql += " gps.\"name\" AS queue_name  ";
		sql += " FROM cc_audit aud ";
		sql += " JOIN operators op ON aud.ext_number = op.phone ";
		sql += " JOIN agents ag ON ag.extensionnumber = op.phone ";
		sql += " JOIN agent_groups agg ON ag.agentid=agg.agentid ";
		sql += " JOIN groups gps ON agg.groupid = gps.groupid ";
		sql += " JOIN (SELECT datetime_end, ext_number, queue_member "; 
		sql += " FROM cc_audit cauta  ";
		sql += " WHERE id IN (SELECT max(id)  ";
		sql += " FROM cc_audit cauta ";
		sql += "	WHERE cauta.datetime_init BETWEEN CAST(NOW() + CAST('-1 days' AS INTERVAL) AS DATE) AND NOW()  ";
		sql += "	    AND id_break IS NULL  ";
		sql += "	GROUP BY ext_number)  ";
		sql += " ) AS fin ON aud.ext_number=fin.ext_number  ";
		sql += " WHERE aud.id IN ( ";
		sql += " SELECT max(id)  ";
		sql += " FROM cc_audit cauta  ";
		sql += " WHERE cauta.datetime_init BETWEEN CAST(NOW() + CAST('-1 days' AS INTERVAL) AS DATE) AND NOW() ";
		sql += " GROUP BY ext_number ";
		sql += " ) ";
		sql += " ORDER BY 1 DESC; ";
	//console.log(sql);
	if(number_users > 0)
	{
	    ageCam = setInterval(function()
	    {
	        query(sql, 'agente_campana_cb'); // query, funcion de retorno (cliente)
	    },2000);
	    y = true;
	}
}


function count_calls()
{
	var sql = "SELECT TRIM(g.name) as queue, count(*) as count FROM queue_calls qc, groups g where TRIM(qc.number) = TRIM(g.groupani) AND status in ('P','B') GROUP BY queue;";
	//console.log(sql);
	if(number_users > 0)
	{
		countCall = setInterval(function()
	    {
	        query(sql, 'count_calls_cb'); // query, funcion de retorno (cliente)
	    },3000);
		y = true;
	}
}

function campana_tmo_ta_tr()
{
	         var sql = "SELECT g.\"name\" as queue_name, ";
	        	 sql += " 		case when qe.tiempoconver_min is null or qe.Atendidas < 1  then '00:00:00' else to_char((qe.tiempoconver_min/qe.Atendidas),'HH24:MI:SS') end tmo,";
        		 sql += "		case when qe.abandonadas is null then 0 else qe.abandonadas end abandonadas, ";
    			 sql += "		case when qe.Atendidas is null then 0 else qe.Atendidas end contestadas";
				 sql += "		from groups g";
				 sql += "		left join (select  qe.queue,";
				 sql += "		count(*)  recibidas,";
				 sql += "		sum(case when qe.agent_startdate >= qe.entry_startdate AND qe.agent_callerid NOT IN ('NotAvailable','NotReceived') then 1 else 0 end) Atendidas,"; 
				 sql += "		sum(case when (qe.agent_callerid IN ('NotAvailable','NotReceived') and qe.status= 'A') or"; 
				 sql += "			(qe.agent_startdate = '0001-01-01 00:00:00' AND qe.agent_enddate = '0001-01-01 00:00:00' AND qe.status= 'A') then 1 else 0 end) abandonadas,";
				 sql += "sum(case when agent_startdate >= entry_startdate then case when qe.entry_enddate = '0001-01-01 00:00:00' then qe.agent_startdate else qe.entry_enddate end - qe.agent_startdate  end)  tiempoconver_min,";
				 sql += "		((sum(case when (EXTRACT(EPOCH FROM cast(coalesce((qe.agent_startdate - qe.entry_startdate)) as interval))) <= 20 AND qe.agent_startdate >= qe.entry_startdate then 1 else 0 end))*100)/";
				 sql += "			case when (count(*)- sum(case when cast((EXTRACT(EPOCH FROM (qe.entry_enddate - qe.entry_startdate))) as bigint) <= 10 and status= 'A'  AND (qe.agent_callerid IN ('NotAvailable','NotReceived')  OR";
				 sql += "			(agent_startdate = '0001-01-01 00:00:00' AND agent_enddate = '0001-01-01 00:00:00')) then 1 else 0 end)) < 1 then 1 else (count(*)- ";
				 sql += "			sum(case when cast((EXTRACT(EPOCH FROM (qe.entry_enddate - qe.entry_startdate))) as bigint) <= 10 and status= 'A'  AND (qe.agent_callerid IN ('NotAvailable','NotReceived')  OR";
				 sql += "			(agent_startdate = '0001-01-01 00:00:00' AND agent_enddate = '0001-01-01 00:00:00')) then 1 else 0 end)) end AS ns ";
				 sql += "		from queue_entry qe ";
				 sql += "		where entry_startdate >= current_date";
				 sql += "		group by qe.queue) qe on g.name=qe.queue;";
    //console.log(sql);
	if(number_users > 0)
	{    
	    indCam = setInterval(function()
	    {
	        query(sql, 'campana_tmo_ta_tr_cb'); // query, funcion de retorno (cliente)
	    },10000);
	    y = true;
	}
}
});

function query(sql, cb_func)
{
		var client = new pg.Client(conString);
		client.connect(function(err){
			if(err)
			{
				return console.error('could not connect to postgres', err);
			}		  
		});
		var query = client.query(sql, function(err, result) {
			if(err) 
			{
				client.end();
				return console.error('error running query', err);
			}	
		});
			
		query.on("end", function (result) {
			io.sockets.emit(cb_func, result);
	        console.log('EMITIO DATOS');
	        client.end();
		});
}
