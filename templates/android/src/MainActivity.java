package <%=config.widget.$.id%>;

import android.os.Bundle;
import org.apache.cordova.*;

import android.view.WindowManager;
import android.view.Window;

public class <%=grunt.util._.classify(config.widget.name)%> extends DroidGap
{
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        <% if(preferences.keepScreenOn) { %>
		getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
		<% } %>
		<% if(preferences.fullscreen) { %>
		requestWindowFeature(Window.FEATURE_NO_TITLE);
    	this.getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
		<% } %>

        super.loadUrl(Config.getStartUrl());
    }
}

