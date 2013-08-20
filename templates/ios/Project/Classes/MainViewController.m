//
//  MainViewController.m
//

#import "MainViewController.h"

@implementation MainViewController


#pragma mark UIWebDelegate implementation

- (void)webViewDidFinishLoad:(UIWebView*)theWebView
{
    theWebView.backgroundColor = [UIColor blackColor];

    return [super webViewDidFinishLoad:theWebView];
}

- (void) webViewDidStartLoad:(UIWebView*)theWebView
{
    <% if(preferences.keepScreenOn) { %>
   	[[UIApplication sharedApplication] setIdleTimerDisabled:YES];
   	<% } %>

    return [super webViewDidStartLoad:theWebView];
}
@end

