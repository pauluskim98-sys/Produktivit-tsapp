using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    private static readonly Uri Home = new("http://127.0.0.1:3000/lifemap");

    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var checkOnly = args.Contains("--check");
        var outcome = checkOnly ? 1 : 0;
        using var window = new Form
        {
            Text = "Lifemap",
            Size = new Size(1280, 850),
            MinimumSize = new Size(700, 480),
            StartPosition = FormStartPosition.CenterScreen,
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            ShowInTaskbar = !checkOnly,
            Opacity = checkOnly ? 0 : 1,
        };
        using var view = new WebView2 { Dock = DockStyle.Fill };
        window.Controls.Add(view);
        using var timer = new System.Windows.Forms.Timer { Interval = 15000 };
        timer.Tick += (_, _) => { timer.Stop(); window.Close(); };

        window.Shown += async (_, _) =>
        {
            if (checkOnly) timer.Start();
            try
            {
                var profile = Path.GetFullPath("data/desktop/webview");
                var options = new CoreWebView2EnvironmentOptions { AreBrowserExtensionsEnabled = false };
                var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile, options: options);
                if (window.IsDisposed) return;
                await view.EnsureCoreWebView2Async(environment);
                var core = view.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.NavigationStarting += (_, e) =>
                {
                    if (IsLocal(e.Uri)) return;
                    e.Cancel = true;
                    if (e.IsUserInitiated) OpenLink(e.Uri);
                };
                core.NewWindowRequested += (_, e) =>
                {
                    e.Handled = true;
                    if (e.IsUserInitiated) OpenLink(e.Uri);
                };
                core.NavigationCompleted += (_, e) =>
                {
                    if (checkOnly)
                    {
                        outcome = e.IsSuccess && core.DocumentTitle.StartsWith("Lifemap", StringComparison.Ordinal) ? 0 : 1;
                        window.Close();
                    }
                    else if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
                    {
                        MessageBox.Show(window, "Lifemap konnte nicht geladen werden. Bitte öffne es erneut über das Desktop-Symbol.", "Lifemap");
                    }
                };
                core.Navigate(Home.AbsoluteUri);
            }
            catch (Exception e)
            {
                if (!checkOnly) MessageBox.Show(window, "Das Lifemap-Fenster konnte nicht gestartet werden. " + e.Message, "Lifemap");
                outcome = 1;
                window.Close();
            }
        };
        Application.Run(window);
        return outcome;
    }

    private static bool IsLocal(string address) =>
        Uri.TryCreate(address, UriKind.Absolute, out var uri) &&
        uri.Scheme == Home.Scheme && uri.Host == Home.Host && uri.Port == Home.Port;

    private static void OpenLink(string address)
    {
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch (Exception) { MessageBox.Show("Der Link konnte nicht geöffnet werden.", "Lifemap"); }
    }
}
