package <%=config.widget.$.id%>;

import android.os.Bundle;
import org.apache.cordova.*;

import android.view.WindowManager;

public class <%=grunt.util._.classify(config.widget.name)%> extends DroidGap
{
    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        <% if(preferences.keepScreenOn) { %>
		getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
		<% } %>

        super.loadUrl(Config.getStartUrl());
    }
}

